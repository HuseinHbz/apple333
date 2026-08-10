import { AdminPermissionGuard } from "@/components/admin/admin-permission-guard";
import { PageContainer } from "@/components/admin/page-container";
import { AdminOrderCreate } from "@/components/orders/admin-order-create";
import { requireAdminPagePermission } from "@/modules/auth/session";

export const metadata = { title: "ثبت سفارش | Apple333" };

export default async function AdminOrderCreatePage() {
  await requireAdminPagePermission("orders.create_admin");
  return (
    <AdminPermissionGuard permission="orders.create_admin">
      <PageContainer
        title="ثبت سفارش مدیریتی"
        description="مبلغ‌ها از فرم دریافت نمی‌شوند؛ خدمت سفارش آن‌ها را از snapshot معتبر کاتالوگ محاسبه و موجودی را اتمیک رزرو می‌کند."
      >
        <AdminOrderCreate />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
