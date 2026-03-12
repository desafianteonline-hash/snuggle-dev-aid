import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Shield, Plus, Trash2, Pencil, MapPin, GripHorizontal, X } from 'lucide-react';
import type { Geofence } from '@/hooks/useGeofences';

interface GeofenceControlsProps {
  geofences: Geofence[];
  addMode: boolean;
  onToggleAddMode: () => void;
  pendingLocation: { lat: number; lng: number } | null;
  onConfirm: (name: string, radius: number, color: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Geofence>) => void;
  pendingRadius: number;
  pendingColor: string;
  onPendingRadiusChange: (r: number) => void;
  onPendingColorChange: (c: string) => void;
}

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];

export function GeofenceControls({
  geofences,
  addMode,
  onToggleAddMode,
  pendingLocation,
  onConfirm,
  onCancel,
  onDelete,
  onUpdate,
  pendingRadius,
  pendingColor,
  onPendingRadiusChange,
  onPendingColorChange,
}: GeofenceControlsProps) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRadius, setEditRadius] = useState(200);
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  // Draggable panel state
  const [dragPos, setDragPos] = useState({ x: Math.max(0, (window.innerWidth - 340) / 2), y: Math.max(0, (window.innerHeight - 400) / 2) });
  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - dragPos.x, y: clientY - dragPos.y };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const cx = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      setDragPos({ x: cx - dragOffset.current.x, y: cy - dragOffset.current.y });
    };
    const onEnd = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  }, [dragPos]);

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim(), pendingRadius, pendingColor);
    setName('');
    onPendingRadiusChange(200);
    onPendingColorChange(COLORS[0]);
  };

  const startEdit = (g: Geofence) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditRadius(g.radius_meters);
    setEditColor(g.color);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;

    const confirmed = window.confirm(`Deseja salvar as alterações da cerca "${editName.trim()}"?`);
    if (!confirmed) return;

    onUpdate(editingId, { name: editName.trim(), radius_meters: editRadius, color: editColor });
    setEditingId(null);
  };

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant={addMode ? 'destructive' : 'outline'}
            size="sm"
            className="gap-1.5"
            title="Gerenciar cercas virtuais"
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cercas</span>
            {geofences.length > 0 && (
              <span className="ml-1 bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {geofences.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 sm:w-96 z-[1001]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Cercas Virtuais
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <Button
              onClick={() => {
                onToggleAddMode();
                setSheetOpen(false);
              }}
              variant={addMode ? 'destructive' : 'default'}
              className="w-full gap-2"
            >
              {addMode ? (
                <>Cancelar seleção no mapa</>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Adicionar nova cerca
                </>
              )}
            </Button>

            {addMode && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm text-primary">
                <MapPin className="h-4 w-4 inline mr-1" />
                Clique no mapa para selecionar o local da cerca
              </div>
            )}

            {geofences.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma cerca cadastrada</p>
                <p className="text-xs mt-1">Clique em "Adicionar" e depois no mapa</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {geofences.length} cerca{geofences.length > 1 ? 's' : ''} ativa{geofences.length > 1 ? 's' : ''}
                </p>
                {geofences.map(g => (
                  <div
                    key={g.id}
                    className="bg-card border border-border rounded-lg p-3"
                  >
                    {editingId === g.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Nome da cerca"
                          autoFocus
                        />
                        <div>
                          <Label className="text-xs text-muted-foreground">Raio: {editRadius}m</Label>
                          <input
                            type="range"
                            min={50}
                            max={2000}
                            step={50}
                            value={editRadius}
                            onChange={e => setEditRadius(Number(e.target.value))}
                            className="w-full mt-1"
                            style={{ accentColor: editColor }}
                          />
                        </div>
                        <div className="flex gap-2">
                          {COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: c,
                                border: c === editColor ? '2px solid white' : '2px solid transparent',
                                boxShadow: c === editColor ? `0 0 0 2px ${c}` : 'none',
                                cursor: 'pointer',
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={!editName.trim()}>Salvar</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: g.color }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                            <p className="text-xs text-muted-foreground">Raio: {g.radius_meters}m</p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(g)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Cerca</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a cerca "{g.name}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDelete(g.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Draggable panel for new geofence after map click */}
      {pendingLocation && (
        <div
          ref={dragRef}
          className="fixed sm:max-w-sm w-[340px] rounded-lg border border-border/50 bg-card/85 backdrop-blur-md shadow-2xl p-4"
          style={{ zIndex: 1100, left: dragPos.x, top: dragPos.y }}
        >
          {/* Drag handle */}
          <div
            className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 text-muted-foreground" />
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold leading-none tracking-tight">Nova Cerca Virtual</span>
            </div>
            <button onClick={onCancel} className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
              <X className="h-4 w-4" />
            </button>
          </div>

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
                Raio: {pendingRadius}m
              </Label>
              <input
                type="range"
                min={50}
                max={2000}
                step={50}
                value={pendingRadius}
                onChange={e => onPendingRadiusChange(Number(e.target.value))}
                className="w-full mt-2"
                style={{ accentColor: pendingColor }}
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
                    onClick={() => onPendingColorChange(c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      border: c === pendingColor ? '3px solid white' : '2px solid transparent',
                      boxShadow: c === pendingColor ? `0 0 0 2px ${c}` : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              📍 {pendingLocation.lat.toFixed(6)}, {pendingLocation.lng.toFixed(6)}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={!name.trim()}>Criar Cerca</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GeofenceControls;
