import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { MarketCard } from '@/components/markets/MarketCard';
import { useMarkets } from '@/hooks/useMarkets';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, TrendingUp } from 'lucide-react';

const CATEGORIES = ['Todos', 'Política', 'Deportes', 'Tecnología', 'Economía', 'Entretenimiento'];

export default function Markets() {
  const { data: markets, isLoading } = useMarkets();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const filteredMarkets = markets?.filter((market) => {
    const matchesSearch = market.title.toLowerCase().includes(search.toLowerCase()) ||
      market.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || market.category === selectedCategory;
    return matchesSearch && matchesCategory && market.status === 'active';
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Mercados</h1>
          <p className="mt-2 text-muted-foreground">
            Explora todos los mercados activos y realiza tus predicciones.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar mercados..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMarkets.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {filteredMarkets.length} mercado{filteredMarkets.length !== 1 ? 's' : ''} encontrado{filteredMarkets.length !== 1 ? 's' : ''}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border bg-card p-12 text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-display text-lg font-semibold">
              No se encontraron mercados
            </h3>
            <p className="mt-2 text-muted-foreground">
              Intenta con otros términos de búsqueda o categoría.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
