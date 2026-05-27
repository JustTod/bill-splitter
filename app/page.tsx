'use client';

import { useState, useEffect, useRef } from 'react';

interface Item {
  id: number;
  name: string;
  unitPrice: number;
  qty: number;
}

interface Person {
  id: number;
  name: string;
}

type Sharing = Record<number, Record<number, boolean>>;
type FixedPay = Record<number, number | null>;

interface SavedState {
  items: Item[];
  persons: Person[];
  sharing: Sharing;
  fixedPay: FixedPay;
  nextItemId: number;
  nextPersonId: number;
  scEnabled: boolean;
  scPct: number;
  vatEnabled: boolean;
  vatPct: number;
}

interface SaveEntry {
  id: string;
  name: string;
  savedAt: number;
  state: SavedState;
}

const SAVES_KEY = 'billSplitter_saves';

function loadSavesFromStorage(): SaveEntry[] {
  try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); }
  catch { return []; }
}

function persistSavesToStorage(saves: SaveEntry[]) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcItem(item: Item, sc: number, vat: number) {
  const sub = round2((item.unitPrice || 0) * (item.qty || 0));
  const scAmt = round2(sub * sc);
  const vatAmt = round2((sub + scAmt) * vat);
  const grand = round2(sub + scAmt + vatAmt);
  return { sub, scAmt, vatAmt, grand };
}

export default function BillSplitter() {
  const [items, setItems] = useState<Item[]>([
    { id: 1, name: '', unitPrice: 0, qty: 1 },
    { id: 2, name: '', unitPrice: 0, qty: 1 },
  ]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [sharing, setSharing] = useState<Sharing>({ 1: {}, 2: {} });
  const [fixedPay, setFixedPay] = useState<FixedPay>({});
  const [nextItemId, setNextItemId] = useState(3);
  const [nextPersonId, setNextPersonId] = useState(1);

  const [scEnabled, setScEnabled] = useState(false);
  const [scPct, setScPct] = useState(10);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPct, setVatPct] = useState(7);

  const [focusItemId, setFocusItemId] = useState<number | null>(null);
  const nameInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [selectedSaveId, setSelectedSaveId] = useState('');

  useEffect(() => { setSaves(loadSavesFromStorage()); }, []);

  useEffect(() => {
    if (focusItemId !== null) {
      nameInputRefs.current[focusItemId]?.focus();
      setFocusItemId(null);
    }
  }, [focusItemId]);

  function handleSave() {
    const name = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
    const entry: SaveEntry = {
      id: genId(), name, savedAt: Date.now(),
      state: { items, persons, sharing, fixedPay, nextItemId, nextPersonId, scEnabled, scPct, vatEnabled, vatPct },
    };
    const updated = [...saves, entry];
    setSaves(updated);
    persistSavesToStorage(updated);
    setSelectedSaveId(entry.id);
  }

  function handleSelectSave(id: string) {
    setSelectedSaveId(id);
    if (!id) return;
    const entry = saves.find(s => s.id === id);
    if (!entry) return;
    const s = entry.state;
    setItems(s.items);
    setPersons(s.persons);
    setSharing(s.sharing);
    setFixedPay(s.fixedPay);
    setNextItemId(s.nextItemId);
    setNextPersonId(s.nextPersonId);
    setScEnabled(s.scEnabled);
    setScPct(s.scPct);
    setVatEnabled(s.vatEnabled);
    setVatPct(s.vatPct);
  }

  function handleDeleteSave() {
    if (!selectedSaveId) return;
    const updated = saves.filter(s => s.id !== selectedSaveId);
    setSaves(updated);
    persistSavesToStorage(updated);
    setSelectedSaveId('');
  }

  const sc = scEnabled ? scPct / 100 : 0;
  const vat = vatEnabled ? vatPct / 100 : 0;

  function addItem() {
    const id = nextItemId;
    setNextItemId(id + 1);
    setItems(prev => [...prev, { id, name: '', unitPrice: 0, qty: 1 }]);
    setSharing(prev => ({
      ...prev,
      [id]: Object.fromEntries(persons.map(p => [p.id, true])),
    }));
    setFocusItemId(id);
  }

  function removeItem(id: number) {
    setItems(prev => prev.filter(i => i.id !== id));
    setSharing(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateItem(id: number, field: 'name' | 'unitPrice' | 'qty', value: string) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'name') return { ...item, name: value };
      if (field === 'unitPrice') return { ...item, unitPrice: parseFloat(value) || 0 };
      return { ...item, qty: parseFloat(value) || 0 };
    }));
  }

  function addPerson() {
    const id = nextPersonId;
    setNextPersonId(id + 1);
    setPersons(prev => [...prev, { id, name: `Person ${id}` }]);
    setSharing(prev => {
      const next = { ...prev };
      items.forEach(item => {
        next[item.id] = { ...(next[item.id] || {}), [id]: true };
      });
      return next;
    });
  }

  function removePerson(id: number) {
    setPersons(prev => prev.filter(p => p.id !== id));
    setSharing(prev => {
      const next: Sharing = {};
      Object.entries(prev).forEach(([itemId, perPerson]) => {
        const updated = { ...perPerson };
        delete updated[id];
        next[Number(itemId)] = updated;
      });
      return next;
    });
    setFixedPay(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updatePersonName(id: number, name: string) {
    setPersons(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }

  function toggleShare(itemId: number, personId: number) {
    setSharing(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [personId]: !prev[itemId]?.[personId] },
    }));
  }

  function updateFixedPay(personId: number, value: string) {
    const num = parseFloat(value);
    setFixedPay(prev => ({
      ...prev,
      [personId]: value === '' || isNaN(num) ? null : num,
    }));
  }

  // Totals (derived)
  let totalSub = 0, totalSc = 0, totalVat = 0, totalGrand = 0;
  items.forEach(item => {
    const c = calcItem(item, sc, vat);
    totalSub += c.sub;
    totalSc += c.scAmt;
    totalVat += c.vatAmt;
    totalGrand += c.grand;
  });
  totalSub = round2(totalSub);
  totalSc = round2(totalSc);
  totalVat = round2(totalVat);
  totalGrand = round2(totalGrand);

  // Step 1: Natural shares per person
  const naturalShares: Record<number, number> = {};
  persons.forEach(p => { naturalShares[p.id] = 0; });
  items.forEach(item => {
    const { grand } = calcItem(item, sc, vat);
    const itemSharing = sharing[item.id] || {};
    const checkedPersons = persons.filter(p => itemSharing[p.id]);
    const sharers = checkedPersons.length > 0 ? checkedPersons : persons;
    if (sharers.length === 0) return;
    let distributed = 0;
    sharers.forEach((p, idx) => {
      const amt = idx === sharers.length - 1
        ? round2(grand - distributed)
        : round2(grand / sharers.length);
      naturalShares[p.id] = round2((naturalShares[p.id] || 0) + amt);
      distributed = round2(distributed + amt);
    });
  });

  // Steps 2-4: Apply fixed pay
  const fixedPersons = persons.filter(p => fixedPay[p.id] != null);
  const floatingPersons = persons.filter(p => fixedPay[p.id] == null);
  const totalFixed = round2(fixedPersons.reduce((sum, p) => sum + (fixedPay[p.id] ?? 0), 0));
  const remaining = round2(totalGrand - totalFixed);
  const floatingNaturalTotal = round2(floatingPersons.reduce((sum, p) => sum + (naturalShares[p.id] || 0), 0));

  const personTotals: Record<number, number> = {};
  fixedPersons.forEach(p => { personTotals[p.id] = round2(fixedPay[p.id] ?? 0); });
  let distributedFloating = 0;
  floatingPersons.forEach((p, idx) => {
    let amt: number;
    if (floatingNaturalTotal === 0 || floatingPersons.length === 0) {
      amt = idx === floatingPersons.length - 1
        ? round2(remaining - distributedFloating)
        : round2(remaining / Math.max(1, floatingPersons.length));
    } else {
      amt = idx === floatingPersons.length - 1
        ? round2(remaining - distributedFloating)
        : round2(remaining * ((naturalShares[p.id] || 0) / floatingNaturalTotal));
    }
    personTotals[p.id] = amt;
    distributedFloating = round2(distributedFloating + amt);
  });

  const totalCollected = round2(Object.values(personTotals).reduce((a, b) => a + b, 0));
  const extraCols = (scEnabled ? 1 : 0) + (vatEnabled ? 1 : 0);

  return (
    <>
      <header>
        <div className="header-title">
          <h1>🧾 Bill Splitter</h1>
          <div className="subtitle">split fair, pay easy</div>
        </div>
        <div className="saves-bar">
          <select
            className="saves-select"
            value={selectedSaveId}
            onChange={e => handleSelectSave(e.target.value)}
          >
            <option value="">— saves —</option>
            {saves.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className="save-btn" onClick={handleSave}>Save</button>
          <button
            className="del-save-btn"
            onClick={handleDeleteSave}
            disabled={!selectedSaveId}
          >Delete</button>
        </div>
      </header>

      {/* 01 CHARGES */}
      <div className="section">
        <div className="section-title"><span>01</span> Charges</div>
        <div className="charges-row">
          <div className="charge-item">
            <label>
              <label className="cb">
                <input type="checkbox" checked={scEnabled} onChange={e => setScEnabled(e.target.checked)} />
                <span></span>
              </label>
              Service Charge
            </label>
            <input
              type="number" className="pct" value={scPct} min={0} max={100} step={0.1}
              disabled={!scEnabled}
              onChange={e => setScPct(parseFloat(e.target.value) || 0)}
            /> %
          </div>
          <div className="charge-item">
            <label>
              <label className="cb">
                <input type="checkbox" checked={vatEnabled} onChange={e => setVatEnabled(e.target.checked)} />
                <span></span>
              </label>
              VAT
            </label>
            <input
              type="number" className="pct" value={vatPct} min={0} max={100} step={0.1}
              disabled={!vatEnabled}
              onChange={e => setVatPct(parseFloat(e.target.value) || 0)}
            /> %
          </div>
        </div>
      </div>

      {/* 02 ITEMS */}
      <div className="section">
        <div className="section-title"><span>02</span> Items</div>
        <div className="scroll-hint">← scroll right to see all columns</div>
        <div className="items-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Item</th>
                <th className="num">Unit Price</th>
                <th className="num">Qty</th>
                <th className="num">Subtotal</th>
                {scEnabled && <th className="num">Svc (+%)</th>}
                {vatEnabled && <th className="num">VAT (+%)</th>}
                <th className="num">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6 + extraCols}>
                    <div className="empty-state">
                      <div className="icon">🍜</div>
                      No items yet — tap &ldquo;+ Add item&rdquo;
                    </div>
                  </td>
                </tr>
              ) : items.map(item => {
                const { sub, scAmt, vatAmt, grand } = calcItem(item, sc, vat);
                return (
                  <tr key={item.id}>
                    <td>
                      <button className="del-btn" onClick={() => removeItem(item.id)} title="Remove">✕</button>
                    </td>
                    <td>
                      <input
                        type="text" className="item-input"
                        placeholder="Item name" value={item.name}
                        ref={el => { nameInputRefs.current[item.id] = el; }}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" className="item-input"
                        placeholder="0" value={item.unitPrice || ''}
                        min={0} step={0.01}
                        onChange={e => updateItem(item.id, 'unitPrice', e.target.value)}
                        style={{ width: 80, textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number" className="item-input qty"
                        placeholder="1" value={item.qty || ''}
                        min={1} step={1}
                        onChange={e => updateItem(item.id, 'qty', e.target.value)}
                      />
                    </td>
                    <td className="num">{fmt(sub)}</td>
                    {scEnabled && <td className="num">{fmt(scAmt)}</td>}
                    {vatEnabled && <td className="num">{fmt(vatAmt)}</td>}
                    <td className="grand">{fmt(grand)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button className="add-row-btn" onClick={addItem}>＋ Add item</button>

        <div className="totals-bar">
          <div className="total-cell">
            <div className="t-label">Subtotal</div>
            <div className="t-value">{fmt(totalSub)}</div>
          </div>
          {scEnabled && (
            <div className="total-cell">
              <div className="t-label">Service</div>
              <div className="t-value">{fmt(totalSc)}</div>
            </div>
          )}
          {vatEnabled && (
            <div className="total-cell">
              <div className="t-label">VAT</div>
              <div className="t-value">{fmt(totalVat)}</div>
            </div>
          )}
          <div className="total-cell">
            <div className="t-label">Total</div>
            <div className="t-value highlight">{fmt(totalGrand)}</div>
          </div>
        </div>
      </div>

      {/* 03 PEOPLE */}
      <div className="section">
        <div className="section-title"><span>03</span> People</div>
        <div className="persons-row">
          {persons.map(p => (
            <div key={p.id} className="person-chip">
              <input
                type="text" value={p.name}
                placeholder="Name" maxLength={16}
                onChange={e => updatePersonName(p.id, e.target.value)}
              />
              <button className="rm-person" onClick={() => removePerson(p.id)} title="Remove">✕</button>
            </div>
          ))}
          <button className="add-person-btn" onClick={addPerson}>+ Add person</button>
        </div>
      </div>

      {/* 04 SHARING */}
      <div className="section">
        <div className="section-title">
          <span>04</span> Who shares what?
          <span style={{ color: 'var(--muted)', fontSize: '0.65rem', marginLeft: 8, letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>
            (uncheck = skip that item for this person)
          </span>
        </div>
        <div className="items-wrapper">
          {persons.length === 0 || items.length === 0 ? (
            <div className="no-persons-hint">Add items and people first</div>
          ) : (
            <table className="sharing-table">
              <thead>
                <tr>
                  <th className="left">Item</th>
                  <th style={{ textAlign: 'right' }}>Grand Total</th>
                  {persons.map(p => <th key={p.id}>{p.name || `P${p.id}`}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const { grand } = calcItem(item, sc, vat);
                  return (
                    <tr key={item.id}>
                      <td className="item-col">{item.name || '(unnamed)'}</td>
                      <td className="price-col">{fmt(grand)}</td>
                      {persons.map(p => (
                        <td key={p.id}>
                          <input
                            type="checkbox" className="share-cb"
                            checked={sharing[item.id]?.[p.id] ?? true}
                            onChange={() => toggleShare(item.id, p.id)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 05 RESULTS */}
      <div className="section">
        <div className="section-title"><span>05</span> Split Summary</div>
        <div className="results-grid">
          {items.length === 0 ? (
            <div className="empty-state"><div className="icon">🧮</div>Add items &amp; people above</div>
          ) : persons.length === 0 ? (
            <div className="empty-state"><div className="icon">👤</div>Add people to split</div>
          ) : (
            <>
              {persons.map(p => {
                const isFixed = fixedPay[p.id] != null;
                return (
                  <div key={p.id} className="result-card">
                    <div className="name">{p.name || `Person ${p.id}`}</div>
                    <div className="amount">{fmt(personTotals[p.id] ?? 0)}</div>
                    {isFixed && (
                      <div className="detail">fixed · fair share: {fmt(naturalShares[p.id] || 0)}</div>
                    )}
                    <input
                      type="number"
                      className="fixed-pay-input"
                      placeholder="Fixed pay…"
                      value={fixedPay[p.id] ?? ''}
                      min={0} step={0.01}
                      onChange={e => updateFixedPay(p.id, e.target.value)}
                    />
                  </div>
                );
              })}
              <div className="result-card bill-total-card">
                <div className="name">Bill Total</div>
                <div className="amount" style={{ color: 'var(--accent2)' }}>{fmt(totalGrand)}</div>
                <div className="detail">collected: {fmt(totalCollected)}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
