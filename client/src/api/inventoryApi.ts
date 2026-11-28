import { baseApi } from './baseApi';

import type {
  InvAdjustment,
  InvBin,
  InvBrand,
  InvCategory,
  InvDashboard,
  InvGoodsReceipt,
  InvIssue,
  InvItem,
  InvLocation,
  InvNonMovingRow,
  InvPurchaseOrder,
  InvPurchaseRequest,
  InvReturn,
  InvStockBalance,
  InvStockMove,
  InvStore,
  InvSupplier,
  InvTaxRate,
  InvTransfer,
  InvUnit,
  InvUsageRow,
  InvValuationRow,
} from '@/types/inventory';

type DocStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';

const invTag = (type: string, id?: number) => (id ? [{ type, id }] : [{ type }]);

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---- Configuration ----
    listStores: build.query<InvStore[], void>({
      query: () => '/inventory/stores',
      providesTags: invTag('InvConfig') as any,
    }),
    createStore: build.mutation<InvStore, Partial<InvStore>>({
      query: (body) => ({ url: '/inventory/stores', method: 'POST', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    updateStore: build.mutation<InvStore, { id: number; body: Partial<InvStore> }>({
      query: ({ id, body }) => ({ url: `/inventory/stores/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    deleteStore: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/stores/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvConfig') as any,
    }),

    listLocations: build.query<InvLocation[], { store_id?: number } | void>({
      query: (arg) => ({
        url: '/inventory/locations',
        params: arg && 'store_id' in arg && arg.store_id ? { store_id: arg.store_id } : undefined,
      }),
      providesTags: invTag('InvConfig') as any,
    }),
    createLocation: build.mutation<InvLocation, Partial<InvLocation>>({
      query: (body) => ({ url: '/inventory/locations', method: 'POST', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    updateLocation: build.mutation<InvLocation, { id: number; body: Partial<InvLocation> }>({
      query: ({ id, body }) => ({ url: `/inventory/locations/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    deleteLocation: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/locations/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvConfig') as any,
    }),

    listBins: build.query<InvBin[], { location_id?: number } | void>({
      query: (arg) => ({
        url: '/inventory/bins',
        params: arg && 'location_id' in arg && arg.location_id ? { location_id: arg.location_id } : undefined,
      }),
      providesTags: invTag('InvConfig') as any,
    }),
    createBin: build.mutation<InvBin, Partial<InvBin>>({
      query: (body) => ({ url: '/inventory/bins', method: 'POST', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    updateBin: build.mutation<InvBin, { id: number; body: Partial<InvBin> }>({
      query: ({ id, body }) => ({ url: `/inventory/bins/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    deleteBin: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/bins/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvConfig') as any,
    }),

    listCategories: build.query<InvCategory[], void>({
      query: () => '/inventory/categories',
      providesTags: invTag('InvConfig') as any,
    }),
    createCategory: build.mutation<InvCategory, Partial<InvCategory>>({
      query: (body) => ({ url: '/inventory/categories', method: 'POST', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    updateCategory: build.mutation<InvCategory, { id: number; body: Partial<InvCategory> }>({
      query: ({ id, body }) => ({ url: `/inventory/categories/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    deleteCategory: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvConfig') as any,
    }),

    listUnits: build.query<InvUnit[], void>({
      query: () => '/inventory/units',
      providesTags: invTag('InvConfig') as any,
    }),
    createUnit: build.mutation<InvUnit, Partial<InvUnit>>({
      query: (body) => ({ url: '/inventory/units', method: 'POST', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    updateUnit: build.mutation<InvUnit, { id: number; body: Partial<InvUnit> }>({
      query: ({ id, body }) => ({ url: `/inventory/units/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    deleteUnit: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/units/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvConfig') as any,
    }),

    listBrands: build.query<InvBrand[], void>({
      query: () => '/inventory/brands',
      providesTags: invTag('InvConfig') as any,
    }),
    createBrand: build.mutation<InvBrand, Partial<InvBrand>>({
      query: (body) => ({ url: '/inventory/brands', method: 'POST', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    updateBrand: build.mutation<InvBrand, { id: number; body: Partial<InvBrand> }>({
      query: ({ id, body }) => ({ url: `/inventory/brands/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    deleteBrand: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/brands/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvConfig') as any,
    }),

    listSuppliers: build.query<InvSupplier[], { search?: string } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/suppliers', params: arg.search ? { search: arg.search } : undefined }),
      providesTags: invTag('InvConfig') as any,
    }),
    createSupplier: build.mutation<InvSupplier, Partial<InvSupplier>>({
      query: (body) => ({ url: '/inventory/suppliers', method: 'POST', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    updateSupplier: build.mutation<InvSupplier, { id: number; body: Partial<InvSupplier> }>({
      query: ({ id, body }) => ({ url: `/inventory/suppliers/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    deleteSupplier: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/suppliers/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvConfig') as any,
    }),

    listTaxRates: build.query<InvTaxRate[], void>({
      query: () => '/inventory/tax-rates',
      providesTags: invTag('InvConfig') as any,
    }),
    createTaxRate: build.mutation<InvTaxRate, Partial<InvTaxRate>>({
      query: (body) => ({ url: '/inventory/tax-rates', method: 'POST', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    updateTaxRate: build.mutation<InvTaxRate, { id: number; body: Partial<InvTaxRate> }>({
      query: ({ id, body }) => ({ url: `/inventory/tax-rates/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvConfig') as any,
    }),
    deleteTaxRate: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/tax-rates/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvConfig') as any,
    }),

    // ---- Items ----
    listItems: build.query<InvItem[], { search?: string; category_id?: number; is_active?: boolean } | void>({
      query: (arg) => ({
        url: '/inventory/items',
        params: arg
          ? {
              ...(arg.search ? { search: arg.search } : {}),
              ...(arg.category_id ? { category_id: arg.category_id } : {}),
              ...(arg.is_active !== undefined ? { is_active: arg.is_active } : {}),
            }
          : undefined,
      }),
      providesTags: invTag('InvItems') as any,
    }),
    createItem: build.mutation<InvItem, Partial<InvItem>>({
      query: (body) => ({ url: '/inventory/items', method: 'POST', body }),
      invalidatesTags: [...invTag('InvItems'), ...invTag('InvStock')] as any,
    }),
    updateItem: build.mutation<InvItem, { id: number; body: Partial<InvItem> }>({
      query: ({ id, body }) => ({ url: `/inventory/items/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvItems') as any,
    }),
    deleteItem: build.mutation<void, number>({
      query: (id) => ({ url: `/inventory/items/${id}`, method: 'DELETE' }),
      invalidatesTags: invTag('InvItems') as any,
    }),

    // ---- Stock ----
    listBalances: build.query<InvStockBalance[], { item_id?: number; store_id?: number } | void>({
      query: (arg) => ({
        url: '/inventory/stock/balances',
        params: arg
          ? {
              ...(arg.item_id ? { item_id: arg.item_id } : {}),
              ...(arg.store_id ? { store_id: arg.store_id } : {}),
            }
          : undefined,
      }),
      providesTags: invTag('InvStock') as any,
    }),
    listMoves: build.query<InvStockMove[], { item_id?: number; limit?: number } | void>({
      query: (arg) => ({
        url: '/inventory/stock/moves',
        params: arg
          ? {
              ...(arg.item_id ? { item_id: arg.item_id } : {}),
              ...(arg.limit ? { limit: arg.limit } : {}),
            }
          : undefined,
      }),
      providesTags: invTag('InvStock') as any,
    }),

    // ---- Purchase requests ----
    listPurchaseRequests: build.query<InvPurchaseRequest[], { status?: DocStatus } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/purchase-requests', params: arg.status ? { status: arg.status } : undefined }),
      providesTags: invTag('InvTransactions') as any,
    }),
    createPurchaseRequest: build.mutation<InvPurchaseRequest, any>({
      query: (body) => ({ url: '/inventory/purchase-requests', method: 'POST', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    updatePurchaseRequest: build.mutation<InvPurchaseRequest, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/inventory/purchase-requests/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    submitPurchaseRequest: build.mutation<InvPurchaseRequest, number>({
      query: (id) => ({ url: `/inventory/purchase-requests/${id}/submit`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    approvePurchaseRequest: build.mutation<InvPurchaseRequest, number>({
      query: (id) => ({ url: `/inventory/purchase-requests/${id}/approve`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    cancelPurchaseRequest: build.mutation<InvPurchaseRequest, number>({
      query: (id) => ({ url: `/inventory/purchase-requests/${id}/cancel`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),

    // ---- Purchase orders ----
    listPurchaseOrders: build.query<InvPurchaseOrder[], { status?: DocStatus } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/purchase-orders', params: arg.status ? { status: arg.status } : undefined }),
      providesTags: invTag('InvTransactions') as any,
    }),
    createPurchaseOrder: build.mutation<InvPurchaseOrder, any>({
      query: (body) => ({ url: '/inventory/purchase-orders', method: 'POST', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    updatePurchaseOrder: build.mutation<InvPurchaseOrder, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/inventory/purchase-orders/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    submitPurchaseOrder: build.mutation<InvPurchaseOrder, number>({
      query: (id) => ({ url: `/inventory/purchase-orders/${id}/submit`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    approvePurchaseOrder: build.mutation<InvPurchaseOrder, number>({
      query: (id) => ({ url: `/inventory/purchase-orders/${id}/approve`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    cancelPurchaseOrder: build.mutation<InvPurchaseOrder, number>({
      query: (id) => ({ url: `/inventory/purchase-orders/${id}/cancel`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),

    // ---- Goods receipts ----
    listGoodsReceipts: build.query<InvGoodsReceipt[], { status?: DocStatus } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/goods-receipts', params: arg.status ? { status: arg.status } : undefined }),
      providesTags: invTag('InvTransactions') as any,
    }),
    createGoodsReceipt: build.mutation<InvGoodsReceipt, any>({
      query: (body) => ({ url: '/inventory/goods-receipts', method: 'POST', body }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    updateGoodsReceipt: build.mutation<InvGoodsReceipt, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/inventory/goods-receipts/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    submitGoodsReceipt: build.mutation<InvGoodsReceipt, number>({
      query: (id) => ({ url: `/inventory/goods-receipts/${id}/submit`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    approveGoodsReceipt: build.mutation<InvGoodsReceipt, number>({
      query: (id) => ({ url: `/inventory/goods-receipts/${id}/approve`, method: 'POST' }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    cancelGoodsReceipt: build.mutation<InvGoodsReceipt, number>({
      query: (id) => ({ url: `/inventory/goods-receipts/${id}/cancel`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),

    // ---- Issues ----
    listIssues: build.query<InvIssue[], { status?: DocStatus; complaint_id?: number } | void>({
      query: (arg: any = {}) => ({
        url: '/inventory/issues',
        params: {
          ...(arg.status ? { status: arg.status } : {}),
          ...(arg.complaint_id ? { complaint_id: arg.complaint_id } : {}),
        },
      }),
      providesTags: invTag('InvTransactions') as any,
    }),
    createIssue: build.mutation<InvIssue, any>({
      query: (body) => ({ url: '/inventory/issues', method: 'POST', body }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    updateIssue: build.mutation<InvIssue, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/inventory/issues/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    submitIssue: build.mutation<InvIssue, number>({
      query: (id) => ({ url: `/inventory/issues/${id}/submit`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    approveIssue: build.mutation<InvIssue, number>({
      query: (id) => ({ url: `/inventory/issues/${id}/approve`, method: 'POST' }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    cancelIssue: build.mutation<InvIssue, number>({
      query: (id) => ({ url: `/inventory/issues/${id}/cancel`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),

    // ---- Returns ----
    listReturns: build.query<InvReturn[], { status?: DocStatus } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/returns', params: arg.status ? { status: arg.status } : undefined }),
      providesTags: invTag('InvTransactions') as any,
    }),
    createReturn: build.mutation<InvReturn, any>({
      query: (body) => ({ url: '/inventory/returns', method: 'POST', body }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    updateReturn: build.mutation<InvReturn, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/inventory/returns/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    submitReturn: build.mutation<InvReturn, number>({
      query: (id) => ({ url: `/inventory/returns/${id}/submit`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    approveReturn: build.mutation<InvReturn, number>({
      query: (id) => ({ url: `/inventory/returns/${id}/approve`, method: 'POST' }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    cancelReturn: build.mutation<InvReturn, number>({
      query: (id) => ({ url: `/inventory/returns/${id}/cancel`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),

    // ---- Transfers ----
    listTransfers: build.query<InvTransfer[], { status?: DocStatus } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/transfers', params: arg.status ? { status: arg.status } : undefined }),
      providesTags: invTag('InvTransactions') as any,
    }),
    createTransfer: build.mutation<InvTransfer, any>({
      query: (body) => ({ url: '/inventory/transfers', method: 'POST', body }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    updateTransfer: build.mutation<InvTransfer, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/inventory/transfers/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    submitTransfer: build.mutation<InvTransfer, number>({
      query: (id) => ({ url: `/inventory/transfers/${id}/submit`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    approveTransfer: build.mutation<InvTransfer, number>({
      query: (id) => ({ url: `/inventory/transfers/${id}/approve`, method: 'POST' }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    cancelTransfer: build.mutation<InvTransfer, number>({
      query: (id) => ({ url: `/inventory/transfers/${id}/cancel`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),

    // ---- Adjustments ----
    listAdjustments: build.query<InvAdjustment[], { status?: DocStatus } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/adjustments', params: arg.status ? { status: arg.status } : undefined }),
      providesTags: invTag('InvTransactions') as any,
    }),
    createAdjustment: build.mutation<InvAdjustment, any>({
      query: (body) => ({ url: '/inventory/adjustments', method: 'POST', body }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    updateAdjustment: build.mutation<InvAdjustment, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/inventory/adjustments/${id}`, method: 'PATCH', body }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    submitAdjustment: build.mutation<InvAdjustment, number>({
      query: (id) => ({ url: `/inventory/adjustments/${id}/submit`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),
    approveAdjustment: build.mutation<InvAdjustment, number>({
      query: (id) => ({ url: `/inventory/adjustments/${id}/approve`, method: 'POST' }),
      invalidatesTags: [...invTag('InvTransactions'), ...invTag('InvStock')] as any,
    }),
    cancelAdjustment: build.mutation<InvAdjustment, number>({
      query: (id) => ({ url: `/inventory/adjustments/${id}/cancel`, method: 'POST' }),
      invalidatesTags: invTag('InvTransactions') as any,
    }),

    // ---- Dashboard & reports ----
    inventoryDashboard: build.query<InvDashboard, void>({
      query: () => '/inventory/dashboard',
      providesTags: invTag('InvDashboard') as any,
    }),
    reportValuation: build.query<InvValuationRow[], void>({
      query: () => '/inventory/reports/valuation',
      providesTags: invTag('InvReports') as any,
    }),
    reportLowStock: build.query<import('@/types/inventory').InvLowStockItem[], void>({
      query: () => '/inventory/reports/low-stock',
      providesTags: invTag('InvReports') as any,
    }),
    reportNonMoving: build.query<InvNonMovingRow[], { days?: number } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/reports/non-moving', params: arg.days ? { days: arg.days } : undefined }),
      providesTags: invTag('InvReports') as any,
    }),
    reportUsage: build.query<InvUsageRow[], { complaint_id?: number } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/reports/usage', params: arg.complaint_id ? { complaint_id: arg.complaint_id } : undefined }),
      providesTags: invTag('InvReports') as any,
    }),
    reportPurchaseHistory: build.query<InvGoodsReceipt[], { supplier_id?: number } | void>({
      query: (arg: any = {}) => ({ url: '/inventory/reports/purchase-history', params: arg.supplier_id ? { supplier_id: arg.supplier_id } : undefined }),
      providesTags: invTag('InvReports') as any,
    }),
    reportReturnsAdjustments: build.query<any[], void>({
      query: () => '/inventory/reports/returns-adjustments',
      providesTags: invTag('InvReports') as any,
    }),
  }),
});

export const {
  useListStoresQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useDeleteStoreMutation,
  useListLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
  useListBinsQuery,
  useCreateBinMutation,
  useUpdateBinMutation,
  useDeleteBinMutation,
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useListUnitsQuery,
  useCreateUnitMutation,
  useUpdateUnitMutation,
  useDeleteUnitMutation,
  useListBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
  useListSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useListTaxRatesQuery,
  useCreateTaxRateMutation,
  useUpdateTaxRateMutation,
  useDeleteTaxRateMutation,
  useListItemsQuery,
  useCreateItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useListBalancesQuery,
  useListMovesQuery,
  useListPurchaseRequestsQuery,
  useCreatePurchaseRequestMutation,
  useUpdatePurchaseRequestMutation,
  useSubmitPurchaseRequestMutation,
  useApprovePurchaseRequestMutation,
  useCancelPurchaseRequestMutation,
  useListPurchaseOrdersQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
  useApprovePurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  useListGoodsReceiptsQuery,
  useCreateGoodsReceiptMutation,
  useUpdateGoodsReceiptMutation,
  useSubmitGoodsReceiptMutation,
  useApproveGoodsReceiptMutation,
  useCancelGoodsReceiptMutation,
  useListIssuesQuery,
  useCreateIssueMutation,
  useUpdateIssueMutation,
  useSubmitIssueMutation,
  useApproveIssueMutation,
  useCancelIssueMutation,
  useListReturnsQuery,
  useCreateReturnMutation,
  useUpdateReturnMutation,
  useSubmitReturnMutation,
  useApproveReturnMutation,
  useCancelReturnMutation,
  useListTransfersQuery,
  useCreateTransferMutation,
  useUpdateTransferMutation,
  useSubmitTransferMutation,
  useApproveTransferMutation,
  useCancelTransferMutation,
  useListAdjustmentsQuery,
  useCreateAdjustmentMutation,
  useUpdateAdjustmentMutation,
  useSubmitAdjustmentMutation,
  useApproveAdjustmentMutation,
  useCancelAdjustmentMutation,
  useInventoryDashboardQuery,
  useReportValuationQuery,
  useReportLowStockQuery,
  useReportNonMovingQuery,
  useReportUsageQuery,
  useReportPurchaseHistoryQuery,
  useReportReturnsAdjustmentsQuery,
} = inventoryApi;