import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { MarketCard } from '@/components/markets/MarketCard';
import { useMarkets } from '@/hooks/useMarkets';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, Zap, Shield, BarChart3, ArrowRight, Loader2 } from 'lucide-react';
export default function Index() {
  const {
    data: markets,
    isLoading
  } = useMarkets();
  const {
    user
  } = useAuth();
  const activeMarkets = markets?.filter(m => m.status === 'active').slice(0, 6) || [];
  return <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-success/5" />
        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Predice el futuro.{' '}
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                Gana recompensas.
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              Apuesta en eventos del mundo real. Política, deportes, tecnología y más.
              Usa tu conocimiento para ganar.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {user ? <Link to="/markets">
                  <Button size="lg" className="gap-2">
                    Explorar mercados
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link> : <>
                  <Link to="/auth?mode=signup">
                    <Button size="lg" className="gap-2">
                      Comenzar gratis
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="outline" size="lg">
                      Iniciar sesión
                    </Button>
                  </Link>
                </>}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-secondary/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Fácil de usar</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apuesta en segundos. Sin complicaciones.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10">
                <Shield className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-display font-semibold">100% transparente</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Todas las apuestas son públicas y verificables.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                <BarChart3 className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Ganancias reales</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tus predicciones correctas te hacen ganar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Active Markets */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold lg:text-3xl">
                Mercados activos
              </h2>
              <p className="mt-2 text-muted-foreground">
                Explora las predicciones más populares
              </p>
            </div>
            <Link to="/markets">
              <Button variant="outline" className="gap-2">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div> : activeMarkets.length > 0 ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeMarkets.map(market => <MarketCard key={market.id} market={market} />)}
            </div> : <div className="rounded-xl border bg-card p-12 text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 font-display text-lg font-semibold">
                No hay mercados activos
              </h3>
              <p className="mt-2 text-muted-foreground">
                Vuelve pronto para ver nuevas predicciones.
              </p>
            </div>}
        </div>
      </section>

      {/* CTA */}
      {!user && <section className="border-t bg-gradient-to-r from-primary/5 via-background to-success/5 py-16 lg:py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-2xl font-bold lg:text-3xl">
              ¿Listo para empezar?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Regístrate ahora y recibe $1,000 en créditos gratis para comenzar a predecir.
            </p>
            <Link to="/auth?mode=signup">
              <Button size="lg" className="mt-8 gap-2">
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>}

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold">Votex
            </span>
            </div>
            <p className="text-sm text-muted-foreground">© 2024 VoteX. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>;
}