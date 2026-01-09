import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Lightbulb, Plus, XCircle, Loader2, DollarSign } from 'lucide-react';

const CATEGORIES = ['Política', 'Deportes', 'Tecnología', 'Economía', 'Entretenimiento', 'Otro'];
const FEE_AMOUNT = 50;

interface SuggestMarketDialogProps {
  userId: string;
  userBalance: number;
}

export function SuggestMarketDialog({ userId, userBalance }: SuggestMarketDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [suggestion, setSuggestion] = useState({
    title: '',
    description: '',
    category: '',
    closes_at: '',
    options: ['', ''],
    selectedOption: '',
  });

  const handleSubmit = async () => {
    if (!suggestion.title || !suggestion.closes_at) {
      toast({
        title: 'Error',
        description: 'Título y fecha de cierre son requeridos.',
        variant: 'destructive',
      });
      return;
    }

    const validOptions = suggestion.options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      toast({
        title: 'Error',
        description: 'Debes agregar al menos 2 opciones.',
        variant: 'destructive',
      });
      return;
    }

    if (!suggestion.selectedOption) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar una opción para tu predicción.',
        variant: 'destructive',
      });
      return;
    }

    if (userBalance < FEE_AMOUNT) {
      toast({
        title: 'Saldo insuficiente',
        description: `Necesitas al menos $${FEE_AMOUNT} para sugerir una predicción.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_market_suggestion', {
        p_user_id: userId,
        p_title: suggestion.title,
        p_description: suggestion.description || null,
        p_category: suggestion.category || null,
        p_closes_at: new Date(suggestion.closes_at).toISOString(),
        p_options: JSON.stringify(validOptions),
        p_selected_option: suggestion.selectedOption,
        p_fee_amount: FEE_AMOUNT,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; suggestion_id?: string };

      if (!result.success) {
        throw new Error(result.error || 'Error al enviar la sugerencia');
      }

      toast({
        title: 'Sugerencia enviada',
        description: `Tu sugerencia ha sido enviada para revisión. Se han descontado $${FEE_AMOUNT} de tu saldo.`,
      });

      setOpen(false);
      setSuggestion({
        title: '',
        description: '',
        category: '',
        closes_at: '',
        options: ['', ''],
        selectedOption: '',
      });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Sugerir predicción
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Sugerir nueva predicción
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4 overflow-y-auto flex-1 pr-2">
          {/* Fee info */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <DollarSign className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium">Tarifa de sugerencia: ${FEE_AMOUNT}</p>
              <p className="text-xs text-muted-foreground">
                Se descontará de tu saldo al enviar. Tu saldo actual: ${userBalance.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título de la predicción *</Label>
            <Input
              id="title"
              value={suggestion.title}
              onChange={(e) => setSuggestion({ ...suggestion, title: e.target.value })}
              placeholder="¿Ganará el equipo X el campeonato?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={suggestion.description}
              onChange={(e) => setSuggestion({ ...suggestion, description: e.target.value })}
              placeholder="Detalles adicionales sobre el evento..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select
              value={suggestion.category}
              onValueChange={(value) => setSuggestion({ ...suggestion, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closes_at">Fecha de cierre *</Label>
            <Input
              id="closes_at"
              type="datetime-local"
              value={suggestion.closes_at}
              onChange={(e) => setSuggestion({ ...suggestion, closes_at: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Opciones de respuesta *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSuggestion({ ...suggestion, options: [...suggestion.options, ''] })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar opción
              </Button>
            </div>
            {suggestion.options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...suggestion.options];
                    newOptions[index] = e.target.value;
                    // Reset selected if the option was modified
                    const newSelected = suggestion.selectedOption === suggestion.options[index] 
                      ? '' 
                      : suggestion.selectedOption;
                    setSuggestion({ ...suggestion, options: newOptions, selectedOption: newSelected });
                  }}
                  placeholder={`Opción ${index + 1}`}
                />
                {suggestion.options.length > 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newOptions = suggestion.options.filter((_, i) => i !== index);
                      const newSelected = suggestion.selectedOption === suggestion.options[index] 
                        ? '' 
                        : suggestion.selectedOption;
                      setSuggestion({ ...suggestion, options: newOptions, selectedOption: newSelected });
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Option selection */}
          {suggestion.options.filter(o => o.trim()).length >= 2 && (
            <div className="space-y-2">
              <Label>Tu predicción * (selecciona una opción)</Label>
              <RadioGroup
                value={suggestion.selectedOption}
                onValueChange={(value) => setSuggestion({ ...suggestion, selectedOption: value })}
                className="grid gap-2"
              >
                {suggestion.options.filter(o => o.trim()).map((option, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                      suggestion.selectedOption === option 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-secondary/50'
                    }`}
                    onClick={() => setSuggestion({ ...suggestion, selectedOption: option })}
                  >
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                    {suggestion.selectedOption === option && (
                      <Badge variant="default" className="text-xs">Tu predicción</Badge>
                    )}
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || userBalance < FEE_AMOUNT}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                Enviar sugerencia (${FEE_AMOUNT})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
