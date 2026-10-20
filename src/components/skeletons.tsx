import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeletons de carga: imitan la forma del contenido real mientras llegan
 * los datos, en vez de mostrar un spinner sobre la pantalla vacía.
 */

/** Imita una tarjeta de mercado (MarketCard). */
export function MarketCardSkeleton() {
  return (
    <div
      className="flex flex-col rounded-2xl border bg-card p-4 sm:p-5"
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
            <Skeleton className="ml-[2.375rem] mt-1.5 h-[3px] rounded-full" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

/** Rejilla de tarjetas de mercado cargando. */
export function MarketGridSkeleton({
  count = 6,
  className = "gap-4 md:grid-cols-2",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid", className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Imita la vista de detalle de un mercado: imagen, título, gráfica y panel de apuesta. */
export function MarketDetailSkeleton() {
  return (
    <main className="container mx-auto px-4 py-6 sm:py-8" aria-hidden="true">
      <Skeleton className="mb-4 h-4 w-36 sm:mb-6" />
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <Skeleton className="aspect-[16/9] w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-8 w-3/4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border bg-card p-4"
              >
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}

/** Filas genéricas tipo lista (notificaciones, mercados del admin, historiales). */
export function ListSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border bg-card p-4"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Filas para usar dentro de una Card existente (perfil: historiales, predicciones). */
export function CardRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Imita el dashboard: saludo, 4 tarjetas de estadísticas y actividad reciente. */
export function DashboardSkeleton() {
  return (
    <main className="container mx-auto px-4 py-6 sm:py-8" aria-hidden="true">
      <div className="mb-6 space-y-2 sm:mb-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl sm:h-12 sm:w-12" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-6 w-4/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <ListSkeleton rows={3} />
    </main>
  );
}

/** Imita las tarjetas de estadísticas del perfil. */
export function StatsSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-6 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Página genérica con encabezado y tarjetas (perfil, retiros, admin). */
export function PageSkeleton() {
  return (
    <main className="container mx-auto px-4 py-6 sm:py-8" aria-hidden="true">
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <CardRowsSkeleton rows={3} />
        </div>
        <div className="rounded-xl border bg-card p-6">
          <CardRowsSkeleton rows={3} />
        </div>
      </div>
    </main>
  );
}
