import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Plus, X } from 'lucide-react';

interface GeofenceControlsProps {
  addMode: boolean;
  onToggleAddMode: () => void;
  pendingLocation: { lat: number; lng: number } | null;
  onConfirm: (name: string, radius: number, color: string) => void;
  onCancel: () => void;
}

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];

export function GeofenceControls({ addMode, onToggleAddMode, pendingLocation, onConfirm, onCancel }: GeofenceControlsProps) {
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(200);
  const [color, setColor] = useState(COLORS[0]);

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim(), radius, color);
    setName('');
    setRadius(200);
    setColor(COLORS[0]);
  };

  return (
    <>
      <Button
        variant={addMode ? 'destructive' : 'outline'}
        size="sm"
        onClick={onToggleAddMode}
        className="gap-1.5"
        title="Adicionar cerca virtual"
      >
        {addMode ? <X className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{addMode ? 'Cancelar' : 'Cercas'}</span>
      </Button>

      <Dialog open={!!pendingLocation} onOpenChange={() => onCancel()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Nova Cerca Virtual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Condomínio Aurora"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Raio: {radius}m
              </Label>
              <input
                type="range"
                min={50}
                max={2000}
                step={50}
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                className="w-full mt-2"
                style={{ accentColor: color }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>50m</span>
                <span>2000m</span>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cor</Label>
              <div className="flex gap-2 mt-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      border: c === color ? '3px solid white' : '2px solid transparent',
                      boxShadow: c === color ? `0 0 0 2px ${c}` : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
            {pendingLocation && (
              <p className="text-xs text-muted-foreground">
                📍 {pendingLocation.lat.toFixed(6)}, {pendingLocation.lng.toFixed(6)}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={!name.trim()}>Criar Cerca</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GeofenceControls;
