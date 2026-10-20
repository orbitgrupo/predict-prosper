import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { EmailConfirmationBanner } from '@/components/layout/EmailConfirmationBanner';
import { MarketCard } from '@/components/markets/MarketCard';
import { MarketCardSkeleton } from '@/components/skeletons';
import { useMarkets } from '@/hooks/useMarkets';
import { SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Todos', 'Política', 'Deportes', 'Tecnología', 'Economía', 'Entretenimiento'];

export default function Markets() {
  const { data: markets, isLoading } = useMarkets();
  const [searchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const searchQuery = searchParams.get('q') || '';

  const filteredMarkets =
    markets?.filter((market) => {
      const matchesSearch =
        market.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'Todos' || market.category === selectedCategory;
      return matchesSearch && matchesCategory && market.status === 'active';
    }) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <EmailConfirmationBanner />

      <main className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold">Mercados</h1>

        {/* Category tabs */}
        <div className="mt-4 border-b">
          <nav className="-mb-px flex gap-6 overflow-x-auto">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'whitespace-nowrap border-b-2 pb-2 text-sm transition-colors',
                  selectedCategory === category
                    ? 'border-foreground font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {category}
              </button>
            ))}
          </nav>
        </div>

        {/* Results */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <MarketCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredMarkets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-12 text-center">
              <SearchX className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                No se encontraron mercados
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Intenta con otros términos de búsqueda o categoría.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
