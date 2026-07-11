import { ValidationError } from '@/server/errors/app-error';
import { validateUploadedMedia, type ValidatedUpload } from '@/modules/media/upload-validation';
import { withAdminRoute } from '@/server/admin/route';
import { createAdminMedia } from '@/server/services/media-service';
import { objectStorage } from '@/server/storage/object-storage';

export const POST = withAdminRoute<ValidatedUpload>({
  permission: 'media.create',
  mutation: true,
  status: 201,
  parse: async (request) => {
    const formData = await request.formData();
    const upload = formData.get('file');
    if (!(upload instanceof File)) {
      throw new ValidationError({ file: 'A media file is required.' });
    }
    return validateUploadedMedia(upload);
  },
  handler: async ({ input, audit }) => {
    await objectStorage.put({
      key: input.media.storageKey,
      contentType: input.media.contentType,
      body: input.body
    });

    try {
      const url = await objectStorage.signedReadUrl(input.media.storageKey);
      return await createAdminMedia({ ...input.media, url }, audit);
    } catch (error) {
      await objectStorage.delete(input.media.storageKey).catch(() => undefined);
      throw error;
    }
  }
});
