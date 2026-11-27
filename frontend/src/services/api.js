import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const HisaabAPI = {
  // Today's 3 urgent actions
  getTodayActions: async (storeId = 1) => {
    const res = await api.get(`/actions/today?store_id=${storeId}`);
    return res.data;
  },

  // KPI Dashboard
  getDashboard: async (period = '30d', storeId = 1) => {
    const res = await api.get(`/dashboard?period=${period}&store_id=${storeId}`);
    return res.data;
  },

  // Product Catalog & Inventory
  getProducts: async ({ search = '', category = '', status = 'all', storeId = 1 } = {}) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (status && status !== 'all') params.append('status', status);
    params.append('store_id', storeId);
    const res = await api.get(`/products?${params.toString()}`);
    return res.data;
  },

  // Single Product Intelligence Detail
  getProductDetail: async (productId, storeId = 1) => {
    const res = await api.get(`/products/${productId}?store_id=${storeId}`);
    return res.data;
  },

  // Dynamic Price Update
  updateProductPrice: async (productId, newSellingPrice, reason = 'Shopkeeper price update') => {
    const res = await api.patch(`/products/${productId}/price`, {
      new_selling_price: parseFloat(newSellingPrice),
      reason,
    });
    return res.data;
  },

  // Dynamic Stock Adjustment / Receipt
  adjustStock: async (productId, quantityChange, reason = 'Stock received') => {
    const res = await api.post(`/products/${productId}/stock-adjustment`, {
      quantity_change: parseFloat(quantityChange),
      reason,
    });
    return res.data;
  },

  // Reorder Budget Optimizer (Knapsack)
  generateReorderPlan: async (budgetPkr, targetCoverDays = 14, storeId = 1) => {
    const res = await api.post('/reorder-plan', {
      budget_pkr: parseFloat(budgetPkr),
      target_cover_days: parseInt(targetCoverDays),
      store_id: storeId,
    });
    return res.data;
  },

  // 7-Day Demand Forecast
  getForecast: async (productId, horizonDays = 7, model = 'best') => {
    const res = await api.post('/forecast', {
      product_id: parseInt(productId),
      horizon_days: parseInt(horizonDays),
      model,
    });
    return res.data;
  },

  // Insights (Margin squeeze & Dead stock)
  getInsights: async (type = 'all', storeId = 1) => {
    const res = await api.get(`/insights?insight_type=${type}&store_id=${storeId}`);
    return res.data;
  },

  // Safe Mark Khata & Credit Summary
  getCreditSummary: async (storeId = 1) => {
    const res = await api.get(`/credit/summary?store_id=${storeId}`);
    return res.data;
  },

  // Dynamic Wasooli Payment
  recordPayment: async (customerId, amount, notes = 'Counter wasooli') => {
    const res = await api.post('/credit/payment', {
      customer_id: parseInt(customerId),
      amount: parseFloat(amount),
      notes,
    });
    return res.data;
  },

  // 7-Day Cash Flow Outlook & Supplier Payables
  getCashOutlook: async (storeId = 1) => {
    const res = await api.get(`/payables/cash-outlook?store_id=${storeId}`);
    return res.data;
  },

  // 3-Tier Copilot Chat
  chatCopilot: async (message, language = 'roman_urdu', conversationHistory = []) => {
    const res = await api.post('/copilot/chat', {
      message,
      language,
      conversation_history: conversationHistory,
      store_id: 1,
    });
    return res.data;
  },

  // Two-Phase CSV Upload & Validation
  uploadCsv: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Commit Staged CSV
  commitCsv: async (fileId, storeId = 1) => {
    const res = await api.post('/import/commit', {
      file_id: fileId,
      store_id: storeId,
    });
    return res.data;
  },

  // Reset Demo Data
  resetDemo: async (seed = 42) => {
    const res = await api.post(`/demo/reset?seed=${seed}`);
    return res.data;
  },
};

export default HisaabAPI;
