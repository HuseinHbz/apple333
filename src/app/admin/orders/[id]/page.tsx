import { AdminPermissionGuard } from "@/components/admin/admin-permission-guard";
import { PageContainer } from "@/components/admin/page-container";
import { AdminOrderDetail } from "@/components/orders/admin-order-detail";
import { requireAdminPagePermission } from "@/modules/auth/session";
import { orderIdRouteInput } from "@/modules/orders/validators";

export const metadata = { title: "جزئیات سفارش | Apple333" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdminPagePermission("orders.read");
  const { id } = orderIdRouteInput.parse(await params);
  return (
    <AdminPermissionGuard permission="orders.read">
      <PageContainer
        title="جزئیات سفارش"
        description="نمایش داده‌ها، اطلاعات مالی و مشخصات مشتری براساس مجوزهای مستقل همین حساب محدود می‌شود."
      >
        <AdminOrderDetail
          orderId={id}
          permissions={Array.from(actor.permissions)}
        />
      </PageContainer>
    </AdminPermissionGuard>
  );
}
