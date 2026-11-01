import { renderPurchaseDetails } from '../src/controllers/purchase/purchaseController.js';

const req = {
  params: { id: 1 },
  user: { name: 'Manager' },
};

const res = {
  render: (view, data) => {
    console.log('VIEW:', view);
    console.log('PO_NO:', data.purchase.poNo);
    console.log('SUPPLIER:', data.purchase.supplier);
    console.log('ITEM_COUNT:', data.purchase.items.length);
    console.log('TOTAL:', data.purchase.formattedTotal);
  },
  redirect: (path) => {
    console.log('REDIRECT:', path);
  },
};

await renderPurchaseDetails(req, res);
process.exit(0);
