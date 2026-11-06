import { CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  DHOTI_OPTION_CATEGORIES,
  ProductCategory,
  ProductCollection,
  ProductIdealFor,
  SHIRT_OPTION_CATEGORIES,
  DhotiSize,
  type Product,
  type ProductVariantPrice,
  DhotiType,
  ShirtSize,
  SleeveLength,
} from '../cart-service';
import { Supabase, type NewProduct } from '../services/supabase';

interface ProductDraft {
  name: string;
  description: string;
  images: Array<{ url: string; file?: File }>;
  category: ProductCategory;
  collection: ProductCollection | '';
  idealFor: ProductIdealFor | '';
  variantPrices: Array<{
    dhotiSize: DhotiSize | '';
    shirtSize: ShirtSize | '';
    sleeveLength: SleeveLength | '';
    dhotiType: DhotiType | '';
    price: number | null;
    quantity: number | null;
  }>;
}

const emptyVariant = (): ProductDraft['variantPrices'][number] => ({
  dhotiSize: '',
  shirtSize: '' as const,
  sleeveLength: '' as const,
  dhotiType: '' as const,
  price: null,
  quantity: 0,
});

const emptyDraft = (): ProductDraft => ({
  name: '',
  description: '',
  images: [],
  category: ProductCategory.SilkDhoti,
  collection: '',
  idealFor: '',
  variantPrices: [emptyVariant()],
});

@Component({
  selector: 'app-manage-products',
  imports: [CurrencyPipe, FormsModule, RouterLink],
  templateUrl: './manage-products.html',
  styleUrl: './manage-products.scss',
})
export class ManageProducts {
  private readonly supabase = inject(Supabase);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isCheckingSession = signal(true);
  readonly isAdmin = signal(false);
  readonly products = signal<Product[]>([]);
  readonly isLoadingProducts = signal(false);
  readonly isSigningIn = signal(false);
  readonly isSaving = signal(false);
  readonly isUploadingImages = signal(false);
  readonly isEditorOpen = signal(false);
  readonly editingProductId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly categories = Object.values(ProductCategory);
  readonly collections = Object.values(ProductCollection);
  readonly idealForOptions = Object.values(ProductIdealFor);
  readonly shirtSizes = Object.values(ShirtSize);
  readonly sleeveLengths = Object.values(SleeveLength);
  readonly dhotiTypes = Object.values(DhotiType);
  readonly dhotiSizes = Object.values(DhotiSize);
  readonly filteredProducts = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const products = this.products();
    return query
      ? products.filter(
          (product) =>
            product.name.toLowerCase().includes(query) ||
            product.category.toLowerCase().includes(query) ||
            product.id.toLowerCase().includes(query),
        )
      : products;
  });

  userId = '';
  password = '';
  draft = emptyDraft();

  get showsDhotiOptions(): boolean {
    return DHOTI_OPTION_CATEGORIES.includes(this.draft.category);
  }

  get showsShirtOptions(): boolean {
    return SHIRT_OPTION_CATEGORIES.includes(this.draft.category);
  }

  constructor() {
    if (this.isBrowser) {
      void this.restoreAdminSession();
    }
  }

  async signIn(): Promise<void> {
    const userId = this.userId.trim();
    if (!userId || !this.password) {
      this.errorMessage.set('Enter your administrator user ID and password.');
      return;
    }

    this.isSigningIn.set(true);
    this.errorMessage.set('');
    try {
      await this.supabase.signInOrderAdmin(userId, this.password);
      this.password = '';
      this.isAdmin.set(true);
      await this.loadProducts();
    } catch (error: unknown) {
      console.error('Failed to sign in to product management.', error);
      this.errorMessage.set('Sign-in failed. Check your credentials and administrator access.');
    } finally {
      this.isSigningIn.set(false);
      this.isCheckingSession.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.errorMessage.set('');
    try {
      await this.supabase.signOutOrderAdmin();
      this.isAdmin.set(false);
      this.products.set([]);
      this.closeEditor();
    } catch (error: unknown) {
      console.error('Failed to sign out of product management.', error);
      this.errorMessage.set('Unable to sign out right now. Please try again.');
    }
  }

  async loadProducts(): Promise<void> {
    this.isLoadingProducts.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      this.products.set(await this.supabase.getAdminProducts());
    } catch (error: unknown) {
      console.error('Failed to load products for product management.', error);
      this.errorMessage.set('Products could not be loaded. Please refresh and try again.');
    } finally {
      this.isLoadingProducts.set(false);
    }
  }

  startNewProduct(): void {
    this.clearImagePreviews();
    this.draft = emptyDraft();
    this.editingProductId.set(null);
    this.isEditorOpen.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  editProduct(product: Product): void {
    this.draft = {
      name: product.name,
      description: product.description,
      images: product.imageUrls.map((url) => ({ url })),
      category: product.category,
      collection: product.collection ?? '',
      idealFor: product.idealFor ?? '',
      variantPrices: (product.variantPrices ?? []).map((variant) => ({
        dhotiSize: variant.dhotiSize ?? '',
        shirtSize: variant.shirtSize ?? '',
        sleeveLength: variant.sleeveLength ?? '',
        dhotiType: variant.dhotiType ?? '',
        price: variant.price,
        quantity: variant.quantity,
      })),
    };
    this.editingProductId.set(product.id);
    this.isEditorOpen.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  closeEditor(): void {
    this.clearImagePreviews();
    this.isEditorOpen.set(false);
    this.editingProductId.set(null);
    this.draft = emptyDraft();
  }

  addVariantPrice(): void {
    this.draft.variantPrices.push(emptyVariant());
  }

  selectImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.errorMessage.set('');

    if (this.draft.images.length + files.length > 6) {
      this.errorMessage.set('A product can have up to 6 images.');
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024,
    );
    if (invalidFile) {
      this.errorMessage.set('Choose JPEG, PNG, or WebP images no larger than 5 MB each.');
      return;
    }

    this.draft.images.push(
      ...files.map((file) => ({ url: URL.createObjectURL(file), file })),
    );
  }

  removeImage(index: number): void {
    const [image] = this.draft.images.splice(index, 1);
    if (image?.file) {
      URL.revokeObjectURL(image.url);
    }
  }

  moveImage(index: number, direction: -1 | 1): void {
    const destination = index + direction;
    if (destination < 0 || destination >= this.draft.images.length) {
      return;
    }
    const [image] = this.draft.images.splice(index, 1);
    this.draft.images.splice(destination, 0, image);
  }

  removeVariantPrice(index: number): void {
    this.draft.variantPrices.splice(index, 1);
  }

  async saveProduct(): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    if (
      !this.draft.name.trim() ||
      !this.draft.description.trim() ||
      !this.draft.category
    ) {
      this.errorMessage.set('Complete the required product details before saving.');
      return;
    }
    if (this.draft.images.length === 0 || this.draft.images.length > 6) {
      this.errorMessage.set('Add between 1 and 6 product images.');
      return;
    }
    if (this.draft.variantPrices.length === 0) {
      this.errorMessage.set('Add at least one product variant.');
      return;
    }
    if (
      this.draft.variantPrices.some(
        (variant) =>
          (this.showsDhotiOptions && (!variant.dhotiSize || !variant.dhotiType)) ||
          (this.showsShirtOptions && (!variant.shirtSize || !variant.sleeveLength)),
      )
    ) {
      this.errorMessage.set('Select every available option for each variant.');
      return;
    }
    if (
      this.draft.variantPrices.some(
        (variant) =>
          variant.price === null ||
          !Number.isSafeInteger(Number(variant.price)) ||
          Number(variant.price) < 0 ||
          variant.quantity === null ||
          !Number.isSafeInteger(Number(variant.quantity)) ||
          Number(variant.quantity) < 0,
      )
    ) {
      this.errorMessage.set('Enter a whole-number price and available quantity for every variant.');
      return;
    }

    const variantKeys = this.draft.variantPrices.map((variant) =>
      [
        this.showsDhotiOptions ? variant.dhotiSize : '',
        this.showsDhotiOptions ? variant.dhotiType : '',
        this.showsShirtOptions ? variant.shirtSize : '',
        this.showsShirtOptions ? variant.sleeveLength : '',
      ].join('|'),
    );
    if (new Set(variantKeys).size !== variantKeys.length) {
      this.errorMessage.set('Each variant must have a unique option combination.');
      return;
    }

    const pendingFiles = this.draft.images.flatMap((image) => (image.file ? [image.file] : []));
    let uploadedImageUrls: string[] = [];
    const product: NewProduct = {
      name: this.draft.name.trim(),
      description: this.draft.description.trim(),
      imageUrls: [],
      category: this.draft.category,
      collection: this.draft.collection || null,
      idealFor: this.draft.idealFor || null,
      variantPrices: this.draft.variantPrices.map((variant) => {
        const variantPrice: ProductVariantPrice = {
          price: Number(variant.price),
          quantity: Number(variant.quantity),
        };
        if (this.showsDhotiOptions && variant.dhotiSize) {
          variantPrice.dhotiSize = variant.dhotiSize;
        }
        if (this.showsDhotiOptions && variant.dhotiType) {
          variantPrice.dhotiType = variant.dhotiType;
        }
        if (this.showsShirtOptions && variant.shirtSize) {
          variantPrice.shirtSize = variant.shirtSize;
        }
        if (this.showsShirtOptions && variant.sleeveLength) {
          variantPrice.sleeveLength = variant.sleeveLength;
        }
        return variantPrice;
      }),
    };

    this.isSaving.set(true);
    this.isUploadingImages.set(pendingFiles.length > 0);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      if (pendingFiles.length > 0) {
        uploadedImageUrls = await this.supabase.uploadProductImages(pendingFiles);
      }
      product.imageUrls = [];
      let uploadIndex = 0;
      for (const image of this.draft.images) {
        product.imageUrls.push(
          image.file ? uploadedImageUrls[uploadIndex++] : image.url,
        );
      }
      const editingId = this.editingProductId();
      if (editingId) {
        await this.supabase.updateProduct(editingId, product);
      } else {
        await this.supabase.createProduct(product);
      }
      this.successMessage.set(
        editingId
          ? 'Product changes submitted and are waiting for admin approval.'
          : 'Product submitted and is waiting for admin approval.',
      );
      this.closeEditor();
    } catch (error: unknown) {
      console.error('Failed to save product.', error);
      if (uploadedImageUrls.length > 0) {
        try {
          await this.supabase.deleteProductImages(uploadedImageUrls);
        } catch (cleanupError: unknown) {
          console.error('Failed to remove newly uploaded product images.', cleanupError);
        }
      }
      this.errorMessage.set('The product could not be saved. Check the details and try again.');
    } finally {
      this.isSaving.set(false);
      this.isUploadingImages.set(false);
    }
  }

  private clearImagePreviews(): void {
    for (const image of this.draft.images) {
      if (image.file) {
        URL.revokeObjectURL(image.url);
      }
    }
  }

  startingPrice(product: Product): number {
    return product.variantPrices.length
      ? Math.min(...product.variantPrices.map((variant) => variant.price))
      : 0;
  }

  totalQuantity(product: Product): number {
    return product.variantPrices.reduce((total, variant) => total + variant.quantity, 0);
  }

  private async restoreAdminSession(): Promise<void> {
    try {
      const isAdmin = await this.supabase.isOrderAdminSignedIn();
      this.isAdmin.set(isAdmin);
      if (isAdmin) {
        await this.loadProducts();
      }
    } catch (error: unknown) {
      console.error('Failed to restore product-management session.', error);
      this.errorMessage.set('Unable to verify your sign-in. Please sign in again.');
    } finally {
      this.isCheckingSession.set(false);
    }
  }
}
