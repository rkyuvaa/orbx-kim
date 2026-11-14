import { baseApi } from './baseApi';
import type { AttachmentFile } from '@/types/requirements';

const encodeRequestNo = (request_no: string) => encodeURIComponent(request_no);

export const materialRequirementsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    uploadMaterialRequirementAttachment: build.mutation<
      AttachmentFile & { file_path?: string },
      { request_no: string; file: File }
    >({
      query: ({ request_no, file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: `/material-requirements/${encodeRequestNo(request_no)}/upload`,
          method: 'POST',
          body: formData,
        };
      },
    }),
    listMaterialRequirementAttachments: build.query<AttachmentFile[], string>({
      query: (request_no) => ({
        url: `/material-requirements/${encodeRequestNo(request_no)}/attachments`,
      }),
      providesTags: (_result, _error, request_no) => [
        { type: 'MaterialRequirementAttachment', id: request_no },
      ],
    }),
    deleteMaterialRequirementAttachment: build.mutation<
      void,
      { request_no: string; attachment_id: string }
    >({
      query: ({ request_no, attachment_id }) => ({
        url: `/material-requirements/${encodeRequestNo(request_no)}/attachments/${attachment_id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { request_no }) => [
        { type: 'MaterialRequirementAttachment', id: request_no },
      ],
    }),
  }),
});

export const {
  useUploadMaterialRequirementAttachmentMutation,
  useListMaterialRequirementAttachmentsQuery,
  useDeleteMaterialRequirementAttachmentMutation,
} = materialRequirementsApi;
