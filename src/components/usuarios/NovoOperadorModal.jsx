import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, Factory, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";
import { registrarAuditoria } from "@/lib/auditHelper";

const MAQUINAS_TELHAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM", "CORTE DE EPS"];
const MAQUINAS_CD = ["CORTE 3M", "CORTE 6M", "DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA", "DESBOBINADEIRA"];
const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];

export default function NovoOperadorModal({
  open,
  onOpenChange,
  defaultSetor = "telhas",
  defaultMaquina = null,
  defaultUnidade = null,
  onSuccess
}) {
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();

  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState(defaultSetor);
  const [unidade, setUnidade] = useState(defaultUnidade || filialAtiva || "Matriz AJL");
  const [maquinas, setMaquinas] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setNome("");
      setSetor(defaultSetor || "telhas");
      setUnidade(defaultUnidade || filialAtiva || "Matriz AJL");
      if (defaultMaquina) {
        setMaquinas([defaultMaquina]);
      } else {
        setMaquinas([]);
      }
    }
  }, [open, defaultSetor, defaultMaquina, defaultUnidade, filialAtiva]);

  const listaMaquinasDisponiveis = setor === "corte_dobra" ? MAQUINAS_CD : MAQUINAS_TELHAS;

  const toggleMaquina = (maq) => {
    setMaquinas((prev) =>
      prev.includes(maq) ? prev.filter((m) => m !== maq) : [...prev, maq]
    );
  };

  const handleSalvar = async () => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.error("Informe o nome do operador");
      return;
    }

    setSalvando(true);
    try {
      // Gera um email slug caso o operador não tenha login próprio
      const slug = nomeLimpo
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, ".");
      const emailGerado = `${slug}@operador.ajl`;

      const maquinaJson = maquinas.length === 1 ? maquinas[0] : JSON.stringify(maquinas);

      const novoUsuario = await base44.entities.User.create({
        full_name: nomeLimpo,
        email: emailGerado,
        role: "operador",
        setor: setor,
        maquina: maquinaJson,
        unidade: unidade,
        filiais_permitidas: [unidade],
        gerencia: false,
        permitido_central_alertas: false
      });

      toast.success(`Operador ${nomeLimpo} cadastrado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["equipe-operadores-dialog"] });
      queryClient.invalidateQueries({ queryKey: ["perf-equipe"] });

      registrarAuditoria({
        acao: "criacao",
        entidade: "User",
        registroId: novoUsuario?.id,
        registroIdentificador: nomeLimpo,
        detalhes: `Cadastrou novo operador ${nomeLimpo} no setor ${setor}${maquinas.length > 0 ? ` (Máquinas: ${maquinas.join(", ")})` : ""}`,
        unidade
      });

      if (onSuccess) {
        onSuccess(novoUsuario);
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar operador: " + (err?.message || "Tente novamente"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Cadastrar Operador do Chão de Fábrica
          </DialogTitle>
          <DialogDescription className="text-xs">
            Adicione operadores rapidamente para alocação nas máquinas e ranking de produtividade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nome Completo do Operador *</Label>
            <Input
              placeholder="Ex: João da Silva, Carlos Eduardo..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          {/* Setor e Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Setor</Label>
              <Select value={setor} onValueChange={(v) => { setSetor(v); setMaquinas([]); }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telhas">Telhas</SelectItem>
                  <SelectItem value="corte_dobra">Corte e Dobra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fábrica / Filial</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Máquinas que Opera */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5 text-muted-foreground" />
                Máquinas que opera ({maquinas.length} selecionadas):
              </Label>
              {maquinas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMaquinas([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-1.5 rounded-lg border border-border bg-muted/20">
              {listaMaquinasDisponiveis.map((maq) => {
                const checked = maquinas.includes(maq);
                return (
                  <label
                    key={maq}
                    onClick={() => toggleMaquina(maq)}
                    className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer select-none transition-all ${
                      checked
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold"
                        : "bg-card border-border/60 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleMaquina(maq)} />
                    <span className="truncate">{maq}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              💡 Vincular máquinas faz o nome deste operador aparecer no topo na hora de iniciar uma OP.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={salvando || !nome.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" /> Cadastrar Operador
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
