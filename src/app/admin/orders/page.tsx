import { AdminPermissionGuard } from "@/components/admin/admin-permission-guard";
import { PageContainer } from "@/components/admin/page-container";
import { AdminOrderList } from "@/components/orders/admin-order-list";
import { requireAdminPagePermission } from "@/modules/auth/session";

export const metadata = { title: "سفارش‌ها | Apple333" };

export default async function AdminOrdersPage() {
  const actor = await requireAdminPagePermission("orders.read");
  return (
    <AdminPermissionGuard permission="orders.read">
      <PageContainer
        title="مدیریت سفارش‌ها"
        description="جست‌وجو، بررسی وضعیت، تخصیص، پرداخت و تحویل سفارش‌ها فقط از مسیرهای ثبت‌شده و مجاز انجام می‌شود."
      >
        <AdminOrderList permissions={Array.from(actor.permissions)} />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
