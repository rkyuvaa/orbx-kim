import { baseApi } from './baseApi';
import type {
  DocumentSequence,
  DocumentSequenceCreateInput,
  DocumentSequenceUpdateInput,
} from '@/types';

export const documentNumberingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDocumentSequences: build.query<DocumentSequence[], void>({
      query: () => ({ url: '/document-numbering' }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ document_type }) => ({ type: 'DocumentNumbering' as const, id: document_type })),
              { type: 'DocumentNumbering', id: 'LIST' },
            ]
          : [{ type: 'DocumentNumbering', id: 'LIST' }],
    }),
    getDocumentSequence: build.query<DocumentSequence, string>({
      query: (type) => ({ url: `/document-numbering/${type}` }),
      providesTags: (_result, _error, type) => [{ type: 'DocumentNumbering', id: type }],
    }),
    createDocumentSequence: build.mutation<DocumentSequence, DocumentSequenceCreateInput>({
      query: (body) => ({
        url: '/document-numbering',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'DocumentNumbering', id: 'LIST' }],
    }),
    updateDocumentSequence: build.mutation<
      DocumentSequence,
      { document_type: string; data: DocumentSequenceUpdateInput }
    >({
      query: ({ document_type, data }) => ({
        url: `/document-numbering/${document_type}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { document_type }) => [
        { type: 'DocumentNumbering', id: document_type },
        { type: 'DocumentNumbering', id: 'LIST' },
      ],
    }),
    deleteDocumentSequence: build.mutation<{ success: boolean; message: string }, string>({
      query: (document_type) => ({
        url: `/document-numbering/${document_type}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'DocumentNumbering', id: 'LIST' }],
    }),
    previewDocumentNumber: build.mutation<
      { preview: string },
      { prefix: string; padding: number; next_number: number; suffix?: string }
    >({
      query: (body) => ({
        url: '/document-numbering/preview',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useGetDocumentSequencesQuery,
  useGetDocumentSequenceQuery,
  useCreateDocumentSequenceMutation,
  useUpdateDocumentSequenceMutation,
  useDeleteDocumentSequenceMutation,
  usePreviewDocumentNumberMutation,
} = documentNumberingApi;
