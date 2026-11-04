const bucket = 'product-images';
const maxImages = 6;
const maxFileSize = 5 * 1024 * 1024;
const maxRequestSize = maxImages * maxFileSize + 128 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DeleteRequest {
  action?: string;
  sessionToken?: string;
  imageUrls?: unknown;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required function environment variable: ${name}`);
  }
  return value;
}

function serviceHeaders(): Record<string, string> {
  const key = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function validSessionToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

async function validateAdminSession(sessionToken: string): Promise<boolean> {
  const url = new URL('/rest/v1/rpc/admin_session_is_valid', requiredEnvironment('SUPABASE_URL'));
  const response = await fetch(url, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ session_token_input: sessionToken }),
  });
  if (!response.ok) {
    throw new Error('Administrator session validation failed.');
  }
  const result: unknown = await response.json();
  return result === true;
}

function extensionForType(type: string): string {
  switch (type) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error('Unsupported product image format.');
  }
}

async function hasExpectedSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    file.type === 'image/webp' &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  );
}

function productImagePath(imageUrl: string, supabaseUrl: string): string | null {
  try {
    const parsedUrl = new URL(imageUrl);
    const baseUrl = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (parsedUrl.origin !== baseUrl.origin || !parsedUrl.pathname.startsWith(prefix)) {
      return null;
    }

    const path = decodeURIComponent(parsedUrl.pathname.slice(prefix.length));
    return /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path) && !parsedUrl.search ? path : null;
  } catch {
    return null;
  }
}

async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  const url = new URL(`/storage/v1/object/${bucket}`, requiredEnvironment('SUPABASE_URL'));
  const response = await fetch(url, {
    method: 'DELETE',
    headers: serviceHeaders(),
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!response.ok) {
    throw new Error('Product image cleanup failed.');
  }
}

async function deleteImages(body: DeleteRequest): Promise<Response> {
  if (!validSessionToken(body.sessionToken)) {
    return jsonResponse({ error: 'A valid administrator session is required.' }, 400);
  }
  if (!(await validateAdminSession(body.sessionToken))) {
    return jsonResponse({ error: 'Administrator sign-in is required.' }, 401);
  }
  if (
    !Array.isArray(body.imageUrls) ||
    body.imageUrls.length === 0 ||
    body.imageUrls.length > maxImages ||
    !body.imageUrls.every((url) => typeof url === 'string')
  ) {
    return jsonResponse({ error: 'A valid list of product images is required.' }, 400);
  }

  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const paths = body.imageUrls.map((url) => productImagePath(url, supabaseUrl));
  if (!paths.every((path): path is string => path !== null)) {
    return jsonResponse({ error: 'One or more product image URLs are invalid.' }, 400);
  }
  await removeObjects(paths);
  return jsonResponse({ deleted: paths.length });
}

async function uploadImages(formData: FormData): Promise<Response> {
  const sessionToken = formData.get('sessionToken');
  if (!validSessionToken(sessionToken)) {
    return jsonResponse({ error: 'A valid administrator session is required.' }, 400);
  }
  if (!(await validateAdminSession(sessionToken))) {
    return jsonResponse({ error: 'Administrator sign-in is required.' }, 401);
  }

  const fileEntries = formData.getAll('images');
  const files = fileEntries.filter((file): file is File => file instanceof File);
  if (
    files.length !== fileEntries.length ||
    files.length === 0 ||
    files.length > maxImages
  ) {
    return jsonResponse({ error: 'Choose between one and six product images.' }, 400);
  }
  if (files.reduce((total, file) => total + file.size, 0) > maxRequestSize) {
    return jsonResponse({ error: 'The combined product images are too large.' }, 400);
  }
  for (const file of files) {
    if (
      file.size === 0 ||
      file.size > maxFileSize ||
      !allowedTypes.has(file.type) ||
      !(await hasExpectedSignature(file))
    ) {
      return jsonResponse(
        { error: 'Images must be valid JPEG, PNG, or WebP files no larger than 5 MB.' },
        400,
      );
    }
  }

  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const uploadedPaths: string[] = [];
  const imageUrls: string[] = [];
  try {
    for (const file of files) {
      const path = `${crypto.randomUUID()}.${extensionForType(file.type)}`;
      const url = new URL(
        `/storage/v1/object/${bucket}/${path}`,
        supabaseUrl,
      );
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...serviceHeaders(),
          'Content-Type': file.type,
          'x-upsert': 'false',
        },
        body: file,
      });
      if (!response.ok) {
        throw new Error('Product image upload failed.');
      }
      uploadedPaths.push(path);
      imageUrls.push(
        new URL(`/storage/v1/object/public/${bucket}/${path}`, supabaseUrl).toString(),
      );
    }
  } catch (error) {
    try {
      await removeObjects(uploadedPaths);
    } catch (cleanupError) {
      console.error('Failed to clean up partially uploaded product images.', cleanupError);
    }
    throw error;
  }

  return jsonResponse({ imageUrls });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxRequestSize) {
    return jsonResponse({ error: 'The product image request is too large.' }, 413);
  }

  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return jsonResponse({ error: 'The product image form is invalid.' }, 400);
      }
      return await uploadImages(formData);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'The product image request is invalid.' }, 400);
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      (body as DeleteRequest).action !== 'delete'
    ) {
      return jsonResponse({ error: 'Invalid product image request.' }, 400);
    }
    return await deleteImages(body as DeleteRequest);
  } catch (error) {
    console.error('Product image operation failed.', error);
    return jsonResponse({ error: 'Product images could not be processed.' }, 500);
  }
});
