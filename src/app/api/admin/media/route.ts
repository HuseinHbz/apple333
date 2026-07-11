import { createMediaInput, mediaListQuery, type CreateMediaInput, type MediaListQuery } from '@/modules/media/validators';
import { jsonBody, queryParams, withAdminRoute } from '@/server/admin/route';
import { createAdminMedia, listAdminMedia } from '@/server/services/media-service';

export const GET = withAdminRoute<MediaListQuery>({
  permission: 'media.read',
  parse: queryParams(mediaListQuery),
  handler: ({ input }) => listAdminMedia(input)
});

export const POST = withAdminRoute<CreateMediaInput>({
  permission: 'media.create',
  mutation: true,
  status: 201,
  parse: jsonBody(createMediaInput),
  handler: ({ input, audit }) => createAdminMedia(input, audit)
});
