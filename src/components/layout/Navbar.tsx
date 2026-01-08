import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, LayoutDashboard, Settings, LogOut, User, Wallet, Search } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';

export function Navbar() {
  const {
    user,
    profile,
    isAdmin,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      navigate(`/markets?q=${encodeURIComponent(value.trim())}`);
    } else {
      navigate('/markets');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return <nav className="sticky top-0 z-50 glass border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">VotoX</span>
          </Link>

          {user && (
            <div className="relative flex-1 max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar mercados..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 bg-secondary/50"
              />
            </div>
          )}

          <div className="flex items-center gap-4">
            {user ? <>
                <Link to="/markets">
                  <Button variant="ghost" size="sm">
                    Mercados
                  </Button>
                </Link>
                
                {profile && <div className="hidden items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 sm:flex">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      ${profile.balance.toLocaleString('es-ES', {
                  minimumFractionDigits: 2
                })}
                    </span>
                  </div>}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{profile?.username || 'Usuario'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Perfil
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" />
                            Panel Admin
                          </Link>
                        </DropdownMenuItem>
                      </>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </> : <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">
                    Iniciar sesión
                  </Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button size="sm">
                    Registrarse
                  </Button>
                </Link>
              </>}
          </div>
        </div>
      </div>
    </nav>;
}