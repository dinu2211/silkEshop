import { CurrencyPipe } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import {
  CartService,
  DHOTI_OPTION_CATEGORIES,
  SHIRT_OPTION_CATEGORIES,
  DhotiType,
  DhotiSize,
  Product,
  type ProductVariantPrice,
  ShirtSize,
  SleeveLength,
} from '../cart-service';

type ProductOptionValue = DhotiSize | DhotiType | ShirtSize | SleeveLength;

@Component({
  selector: 'app-product-details',
  imports: [CurrencyPipe, MatIcon],
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
})
export class ProductDetails implements OnChanges {
  @Input({ required: true }) product!: Product;
  @Output() readonly close = new EventEmitter<void>();

  private readonly cartService = inject(CartService);

  readonly dhotiSizes = Object.values(DhotiSize);
  readonly shirtSizes = Object.values(ShirtSize);
  readonly sleeveLengths = Object.values(SleeveLength);
  readonly dhotiTypes = Object.values(DhotiType);

  dhotiSize = DhotiSize.EightMulam;
  dhotiType = DhotiType.WithVelcroPocket;
  shirtSize = ShirtSize.Medium;
  sleeveLength = SleeveLength.FullSleeve;
  quantity = 1;
  selectedImageIndex = 0;

  get selectedImage(): string | null {
    return this.product.imageUrls[this.selectedImageIndex] ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      const availableVariant = this.product.variantPrices.find((variant) => variant.quantity > 0);
      if (availableVariant) {
        this.dhotiSize = availableVariant.dhotiSize ?? this.dhotiSize;
        this.dhotiType = availableVariant.dhotiType ?? this.dhotiType;
        this.shirtSize = availableVariant.shirtSize ?? this.shirtSize;
        this.sleeveLength = availableVariant.sleeveLength ?? this.sleeveLength;
      }
      this.quantity = 1;
      this.selectedImageIndex = 0;
    }
  }

  selectImage(index: number): void {
    if (index >= 0 && index < this.product.imageUrls.length) {
      this.selectedImageIndex = index;
    }
  }

  previousImage(): void {
    this.selectImage(
      (this.selectedImageIndex - 1 + this.product.imageUrls.length) %
        this.product.imageUrls.length,
    );
  }

  nextImage(): void {
    this.selectImage((this.selectedImageIndex + 1) % this.product.imageUrls.length);
  }

  get showsDhotiSize(): boolean {
    return DHOTI_OPTION_CATEGORIES.includes(this.product.category);
  }

  get showsShirtOptions(): boolean {
    return SHIRT_OPTION_CATEGORIES.includes(this.product.category);
  }

  get selectedVariant(): ProductVariantPrice | undefined {
    return this.product.variantPrices
      .filter((variant) => this.matchesSelection(variant))
      .sort((left, right) => this.variantSpecificity(right) - this.variantSpecificity(left))[0];
  }

  get selectedPrice(): number | null {
    return this.selectedVariant?.price ?? null;
  }

  get availableQuantity(): number {
    return this.selectedVariant?.quantity ?? 0;
  }

  get remainingQuantity(): number {
    return Math.max(
      0,
      this.availableQuantity -
        this.cartService.quantityForVariant({
          id: this.product.id,
          dhotiSize: this.showsDhotiSize ? this.dhotiSize : undefined,
          dhotiType: this.showsDhotiSize ? this.dhotiType : undefined,
          shirtSize: this.showsShirtOptions ? this.shirtSize : undefined,
          sleeveLength: this.showsShirtOptions ? this.sleeveLength : undefined,
        }),
    );
  }

  optionAvailable(
    option: 'dhotiSize' | 'dhotiType' | 'shirtSize' | 'sleeveLength',
    value: ProductOptionValue,
  ): boolean {
    return this.product.variantPrices.some(
      (variant) =>
        variant.quantity > 0 &&
        (!variant[option] || variant[option] === value),
    );
  }

  selectDhotiSize(value: DhotiSize): void {
    this.dhotiSize = value;
    this.clampQuantity();
  }

  selectDhotiType(value: DhotiType): void {
    this.dhotiType = value;
    this.clampQuantity();
  }

  selectShirtSize(value: ShirtSize): void {
    this.shirtSize = value;
    this.clampQuantity();
  }

  selectSleeveLength(value: SleeveLength): void {
    this.sleeveLength = value;
    this.clampQuantity();
  }

  private clampQuantity(): void {
    this.quantity = Math.max(1, Math.min(this.quantity, this.remainingQuantity || 1));
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity -= 1;
    }
  }

  increaseQuantity(): void {
    if (this.quantity < this.remainingQuantity) {
      this.quantity += 1;
    }
  }

  addToCart(): void {
    if (!this.selectedVariant || this.remainingQuantity < this.quantity) {
      return;
    }

    this.cartService.addToCart(
      {
        id: this.product.id,
        name: this.product.name,
        price: this.selectedVariant.price,
        stockQuantity: this.availableQuantity,
        imageUrl: this.product.imageUrls[0],
        category: this.product.category,
        collection: this.product.collection,
        idealFor: this.product.idealFor,
        ...(this.showsDhotiSize ? { dhotiSize: this.dhotiSize } : {}),
        ...(this.showsDhotiSize ? { dhotiType: this.dhotiType } : {}),
        ...(this.showsShirtOptions
          ? { shirtSize: this.shirtSize, sleeveLength: this.sleeveLength }
          : {}),
      },
      this.quantity,
    );
    this.close.emit();
  }

  private matchesSelection(
    variant: ProductVariantPrice,
    selection = {
      dhotiSize: this.showsDhotiSize ? this.dhotiSize : undefined,
      dhotiType: this.showsDhotiSize ? this.dhotiType : undefined,
      shirtSize: this.showsShirtOptions ? this.shirtSize : undefined,
      sleeveLength: this.showsShirtOptions ? this.sleeveLength : undefined,
    },
  ): boolean {
    return (
      (!variant.dhotiSize || variant.dhotiSize === selection.dhotiSize) &&
      (!variant.dhotiType || variant.dhotiType === selection.dhotiType) &&
      (!variant.shirtSize || variant.shirtSize === selection.shirtSize) &&
      (!variant.sleeveLength || variant.sleeveLength === selection.sleeveLength)
    );
  }

  private variantSpecificity(variant: ProductVariantPrice): number {
    return [
      variant.dhotiSize,
      variant.dhotiType,
      variant.shirtSize,
      variant.sleeveLength,
    ].filter(Boolean).length;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
