import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Icon from '../components/Icon';
import StatusDot from '../components/StatusDot';

/* Catálogo de tipos de manutenção com durabilidade default sugerida */
const KINDS = [
  { id: 'oleo_motor',           label: 'Óleo do motor',         dur_km: 5000,  dur_meses: 6 },
  { id: 'filtro_oleo',          label: 'Filtro de óleo',        dur_km: 5000,  dur_meses: 6 },
  { id: 'filtro_combustivel',   label: 'Filtro de combustível', dur_km: 15000, dur_meses: 12 },
  { id: 'filtro_ar',            label: 'Filtro de ar',          dur_km: 10000, dur_meses: 12 },
  { id: 'agua_radiador',        label: 'Água do radiador',      dur_km: null,  dur_meses: 12 },
  { id: 'carburador',           label: 'Regulagem de carburador', dur_km: null, dur_meses: 12 },
  { id: 'velas',                label: 'Velas',                 dur_km: 20000, dur_meses: 18 },
  { id: 'cabos_velas',          label: 'Cabos de vela',         dur_km: 30000, dur_meses: 24 },
  { id: 'embreagem',            label: 'Embreagem',             dur_km: 80000, dur_meses: null },
  { id: 'pastilha',             label: 'Pastilhas de freio',    dur_km: 30000, dur_meses: null },
  { id: 'fluido_freio',         label: 'Fluido de freio',       dur_km: null,  dur_meses: 24 },
  { id: 'amortecedor',          label: 'Amortecedor',           dur_km: 60000, dur_meses: null },
  { id: 'pneu',                 label: 'Pneu',                  dur_km: 40000, dur_meses: 60 },
  { id: 'bateria',              label: 'Bateria',               dur_km: null,  dur_meses: 24 },
  { id: 'correia',              label: 'Correia dentada',       dur_km: 40000, dur_meses: 36 },
  { id: 'outro',                label: 'Outro',                 dur_km: null,  dur_meses: null },
];

export default function Vehicle() {
  const [tab, setTab] = useState('dados');
  const [veh, setVeh] = useState(null);
  const [logs, setLogs] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [v, m, u] = await Promise.all([
        api.get('/api/vehicle'),
        api.get('/api/vehicle/maintenance'),
        api.get('/api/vehicle/maintenance/upcoming'),
      ]);
      setVeh(v.data?.vehicle || null);
      setLogs(m.data?.logs || []);
      setUpcoming(u.data?.upcoming || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
        <Icon name="truck" size={28} color="var(--c-accent)" />
        <h1>{veh?.apelido || 'C14 do Costa'}</h1>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid var(--c-border)' }}>
        {['dados','manutencao','proximas'].map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 14px', background: 'transparent',
              border: 'none', borderBottom: tab === t ? '2px solid var(--c-accent)' : '2px solid transparent',
              color: tab === t ? 'var(--c-accent)' : 'var(--c-text-3)',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            }}
          >{t === 'dados' ? 'Dados' : t === 'manutencao' ? 'Manutenção' : 'Próximas'}</button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--c-text-3)' }}>Carregando…</div>}

      {!loading && tab === 'dados' && veh && <VehicleData veh={veh} onUpdate={load} />}

      {!loading && tab === 'manutencao' && (
        <>
          <button className="gar-btn" onClick={() => setShowAdd(true)} style={{ marginBottom: '14px' }}>
            <Icon name="check" size={16} /> Registrar troca
          </button>
          {showAdd && <AddMaintenance kmAtual={veh?.km_atual} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
          <MaintList logs={logs} onDel={async (id) => { await api.delete(`/api/vehicle/maintenance/${id}`); load(); }} />
        </>
      )}

      {!loading && tab === 'proximas' && <Upcoming items={upcoming} />}
    </div>
  );
}

function VehicleData({ veh, onUpdate }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(() => ({ ...veh }));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch('/api/vehicle', form);
      setEdit(false);
      onUpdate();
    } finally { setSaving(false); }
  }

  if (edit) {
    return (
      <div className="gar-card" style={{ padding: '16px' }}>
        <Field label="Apelido" v={form.apelido} onC={v => setForm(f => ({ ...f, apelido: v }))} />
        <Field label="Modelo" v={form.modelo} onC={v => setForm(f => ({ ...f, modelo: v }))} />
        <Field label="Ano" type="number" v={form.ano} onC={v => setForm(f => ({ ...f, ano: parseInt(v) || null }))} />
        <Field label="Placa" v={form.placa} onC={v => setForm(f => ({ ...f, placa: v }))} />
        <Field label="Chassi" v={form.chassi} onC={v => setForm(f => ({ ...f, chassi: v }))} />
        <Field label="Motor" v={form.motor} onC={v => setForm(f => ({ ...f, motor: v }))} />
        <Field label="Cor" v={form.cor} onC={v => setForm(f => ({ ...f, cor: v }))} />
        <Field label="Combustível" v={form.combustivel} onC={v => setForm(f => ({ ...f, combustivel: v }))} />
        <Field label="Quilometragem atual" type="number" v={form.km_atual} onC={v => setForm(f => ({ ...f, km_atual: parseInt(v) || null, km_atual_at: new Date().toISOString() }))} />
        <Field label="Pressão pneu dianteiro (psi)" type="number" v={form.pressao_pneu_dianteiro} onC={v => setForm(f => ({ ...f, pressao_pneu_dianteiro: parseFloat(v) || null }))} />
        <Field label="Pressão pneu traseiro (psi)" type="number" v={form.pressao_pneu_traseiro} onC={v => setForm(f => ({ ...f, pressao_pneu_traseiro: parseFloat(v) || null }))} />
        <Field label="Vencimento IPVA (YYYY-MM-DD)" v={form.vencimento_ipva} onC={v => setForm(f => ({ ...f, vencimento_ipva: v }))} />
        <Field label="Vencimento Seguro" v={form.vencimento_seguro} onC={v => setForm(f => ({ ...f, vencimento_seguro: v }))} />
        <Field label="Observações" textarea v={form.observacoes} onC={v => setForm(f => ({ ...f, observacoes: v }))} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button className="gar-btn" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
          <button className="gar-btn gar-btn-secondary" onClick={() => { setEdit(false); setForm({ ...veh }); }}>Cancelar</button>
        </div>
      </div>
    );
  }

  const rows = [
    ['Modelo', veh.modelo], ['Ano', veh.ano], ['Placa', veh.placa],
    ['Chassi', veh.chassi], ['Motor', veh.motor], ['Cor', veh.cor],
    ['Combustível', veh.combustivel],
    ['Quilometragem', veh.km_atual ? `${veh.km_atual.toLocaleString('pt-BR')} km` : null],
    ['Pneu dianteiro', veh.pressao_pneu_dianteiro ? `${veh.pressao_pneu_dianteiro} psi` : null],
    ['Pneu traseiro', veh.pressao_pneu_traseiro ? `${veh.pressao_pneu_traseiro} psi` : null],
    ['Vencimento IPVA', veh.vencimento_ipva],
    ['Vencimento Seguro', veh.vencimento_seguro],
  ];
  return (
    <div className="gar-card" style={{ padding: '16px' }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--c-border)', fontSize: '13.5px' }}>
          <span style={{ color: 'var(--c-text-3)' }}>{k}</span>
          <span style={{ fontWeight: 600, color: 'var(--c-text-1)' }}>{v || '—'}</span>
        </div>
      ))}
      {veh.observacoes && (
        <div style={{ paddingTop: '10px', fontSize: '13px', color: 'var(--c-text-2)' }}>
          <strong>Notas:</strong> {veh.observacoes}
        </div>
      )}
      <button className="gar-btn gar-btn-secondary" onClick={() => setEdit(true)} style={{ marginTop: '14px', width: '100%' }}>Editar</button>
    </div>
  );
}

function AddMaintenance({ kmAtual, onClose, onSaved }) {
  const [kind, setKind] = useState('oleo_motor');
  const def = KINDS.find(k => k.id === kind);
  const [form, setForm] = useState({
    peca: '', marca: '', km: kmAtual || '', data: new Date().toISOString().slice(0, 10),
    durabilidade_km: '', durabilidade_meses: '', valor: '', fornecedor: '', notas: '',
  });
  useEffect(() => {
    setForm(f => ({
      ...f,
      durabilidade_km: def?.dur_km ?? '',
      durabilidade_meses: def?.dur_meses ?? '',
      peca: def?.label || f.peca,
    }));
  }, [kind]);

  async function save() {
    await api.post('/api/vehicle/maintenance', {
      kind, ...form,
      km: parseInt(form.km) || null,
      durabilidade_km: parseInt(form.durabilidade_km) || null,
      durabilidade_meses: parseInt(form.durabilidade_meses) || null,
      valor: parseFloat(form.valor) || null,
    });
    onSaved();
  }

  return (
    <div className="gar-card" style={{ padding: '16px', marginBottom: '14px' }}>
      <h3 style={{ marginBottom: '10px' }}>Nova troca</h3>
      <select value={kind} onChange={e => setKind(e.target.value)} style={{ width: '100%', marginBottom: '10px' }}>
        {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
      </select>
      <Field label="Peça/serviço" v={form.peca} onC={v => setForm(f => ({ ...f, peca: v }))} />
      <Field label="Marca" v={form.marca} onC={v => setForm(f => ({ ...f, marca: v }))} />
      <Field label="Km na troca" type="number" v={form.km} onC={v => setForm(f => ({ ...f, km: v }))} />
      <Field label="Data" type="date" v={form.data} onC={v => setForm(f => ({ ...f, data: v }))} />
      <Field label="Durabilidade (km)" type="number" v={form.durabilidade_km} onC={v => setForm(f => ({ ...f, durabilidade_km: v }))} />
      <Field label="Durabilidade (meses)" type="number" v={form.durabilidade_meses} onC={v => setForm(f => ({ ...f, durabilidade_meses: v }))} />
      <Field label="Valor (R$)" type="number" v={form.valor} onC={v => setForm(f => ({ ...f, valor: v }))} />
      <Field label="Fornecedor" v={form.fornecedor} onC={v => setForm(f => ({ ...f, fornecedor: v }))} />
      <Field label="Notas" textarea v={form.notas} onC={v => setForm(f => ({ ...f, notas: v }))} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button className="gar-btn" onClick={save}>Salvar</button>
        <button className="gar-btn gar-btn-secondary" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

function MaintList({ logs, onDel }) {
  if (logs.length === 0) {
    return <div style={{ padding: '30px', textAlign: 'center', color: 'var(--c-text-3)' }}>Nenhuma troca registrada ainda.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {logs.map(l => (
        <div key={l.id} className="gar-card" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>{l.peca}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-text-3)', marginTop: '2px' }}>
                {l.data}{l.km ? ` · ${Number(l.km).toLocaleString('pt-BR')} km` : ''}{l.marca ? ` · ${l.marca}` : ''}
              </div>
              {l.notas && <div style={{ fontSize: '12.5px', color: 'var(--c-text-2)', marginTop: '6px' }}>{l.notas}</div>}
              {(l.durabilidade_km || l.durabilidade_meses) && (
                <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '6px' }}>
                  Durabilidade: {l.durabilidade_km ? `${l.durabilidade_km} km` : ''}{l.durabilidade_km && l.durabilidade_meses ? ' / ' : ''}{l.durabilidade_meses ? `${l.durabilidade_meses} meses` : ''}
                </div>
              )}
            </div>
            <button onClick={() => { if (confirm('Remover este registro?')) onDel(l.id); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--c-text-4)', padding: '4px', cursor: 'pointer' }}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Upcoming({ items }) {
  if (items.length === 0) {
    return <div style={{ padding: '30px', textAlign: 'center', color: 'var(--c-text-3)' }}>Sem trocas registradas com durabilidade — adicione uma manutenção pra começar a acompanhar.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {items.map(it => (
        <div key={it.id} className="gar-card" style={{ padding: '14px', borderLeft: `4px solid ${it.precisa_trocar ? 'var(--c-bowtie)' : 'var(--c-success)'}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <StatusDot tone={it.precisa_trocar ? 'danger' : 'success'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{it.peca}</div>
              <div style={{ fontSize: '12px', color: 'var(--c-text-3)', marginTop: '2px' }}>
                Última: {it.data}{it.km ? ` · ${Number(it.km).toLocaleString('pt-BR')} km` : ''}
              </div>
              {it.precisa_trocar && (
                <div style={{ fontSize: '12px', color: 'var(--c-bowtie)', marginTop: '6px', fontWeight: 600 }}>{it.motivo}</div>
              )}
              {!it.precisa_trocar && it.motivo === null && (
                <div style={{ fontSize: '12px', color: 'var(--c-success)', marginTop: '6px' }}>Dentro do prazo</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, v, onC, type = 'text', textarea }) {
  const Comp = textarea ? 'textarea' : 'input';
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--c-text-3)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</label>
      <Comp type={type} value={v ?? ''} onChange={e => onC(e.target.value)} style={{ width: '100%', minHeight: textarea ? '70px' : 'auto' }} />
    </div>
  );
}
