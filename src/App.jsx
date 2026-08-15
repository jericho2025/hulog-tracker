import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./App.css";

function peso(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount || 0));
}

function toDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getMonthlyStatus(records, person) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const paid = records.some((record) => {
    const savedDate = new Date(record.saved_at);
    const savedDay = savedDate.getDate();

    return (
      record.person === person &&
      savedDate.getFullYear() === year &&
      savedDate.getMonth() === month &&
      savedDay >= 15 &&
      savedDay <= 30
    );
  });

  if (paid) return { text: "Paid", tone: "paid" };
  if (day < 15) return { text: "Not due", tone: "neutral" };
  if (day <= 30) return { text: "Due", tone: "due" };
  return { text: "Overdue", tone: "overdue" };
}

function App() {
  const [records, setRecords] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState("Jec");
  const [activeView, setActiveView] = useState("Jec");
  const [amount, setAmount] = useState("");
  const [savedAt, setSavedAt] = useState(toDateInputValue());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function loadRecords() {
    if (!supabase) {
      setMessage("Supabase is not connected.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("savings_records")
      .select("*")
      .order("saved_at", { ascending: false });

    if (error) {
      setMessage("Unable to load records.");
      setLoading(false);
      return;
    }

    setRecords(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const jecRecords = useMemo(
    () => records.filter((record) => record.person === "Jec"),
    [records]
  );

  const belRecords = useMemo(
    () => records.filter((record) => record.person === "Bel"),
    [records]
  );

  const jecTotal = useMemo(
    () => jecRecords.reduce((sum, record) => sum + Number(record.amount), 0),
    [jecRecords]
  );

  const belTotal = useMemo(
    () => belRecords.reduce((sum, record) => sum + Number(record.amount), 0),
    [belRecords]
  );

  const totalSavings = jecTotal + belTotal;

  const visibleRecords = useMemo(() => {
    if (activeView === "Jec") return jecRecords;
    if (activeView === "Bel") return belRecords;
    return records;
  }, [activeView, jecRecords, belRecords, records]);

  const jecStatus = getMonthlyStatus(records, "Jec");
  const belStatus = getMonthlyStatus(records, "Bel");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Connect Supabase first.");
      return;
    }

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("savings_records")
      .insert({
        person: selectedPerson,
        amount: numericAmount,
        saved_at: new Date(savedAt).toISOString(),
      })
      .select()
      .single();

    if (error) {
      setMessage("Record was not added.");
      setSaving(false);
      return;
    }

    setRecords((current) => [data, ...current]);
    setAmount("");
    setSavedAt(toDateInputValue());
    setActiveView(selectedPerson);
    setMessage("Added successfully.");
    setSaving(false);
  }

  async function handleDelete(record) {
    if (!supabase) {
      setMessage("Connect Supabase first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${record.person} record ${peso(record.amount)} on ${formatDate(
        record.saved_at
      )}?`
    );

    if (!confirmed) return;

    setDeletingId(record.id);
    setMessage("");

    const { error } = await supabase
      .from("savings_records")
      .delete()
      .eq("id", record.id);

    if (error) {
      setMessage("Record was not deleted.");
      setDeletingId(null);
      return;
    }

    setRecords((current) => current.filter((item) => item.id !== record.id));
    setMessage("Record deleted.");
    setDeletingId(null);
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Savings</p>
          <h1>Tracker</h1>
        </div>

        <div className="top-total">
          <span>Total</span>
          <strong>{peso(totalSavings)}</strong>
        </div>
      </header>

      <section className="card">
        <div className="card-title">
          <h2>Add Record</h2>
          <p>Choose who will save.</p>
        </div>

        <div className="person-buttons">
          <button
            type="button"
            className={selectedPerson === "Jec" ? "active" : ""}
            onClick={() => setSelectedPerson("Jec")}
          >
            Jec
          </button>

          <button
            type="button"
            className={selectedPerson === "Bel" ? "active" : ""}
            onClick={() => setSelectedPerson("Bel")}
          >
            Bel
          </button>
        </div>

        <form className="entry-form" onSubmit={handleSubmit}>
          <label>
            Amount
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label>
            Date
            <input
              type="datetime-local"
              value={savedAt}
              onChange={(event) => setSavedAt(event.target.value)}
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add"}
          </button>
        </form>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="card">
        <div className="card-title">
          <h2>Monthly Status</h2>
          <p>Due every 15–30</p>
        </div>

        <div className="status-list">
          <div className={`status-item ${jecStatus.tone}`}>
            <span>Jec</span>
            <strong>{jecStatus.text}</strong>
          </div>

          <div className={`status-item ${belStatus.tone}`}>
            <span>Bel</span>
            <strong>{belStatus.text}</strong>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        <div>
          <span>Jec</span>
          <strong>{peso(jecTotal)}</strong>
        </div>

        <div>
          <span>Bel</span>
          <strong>{peso(belTotal)}</strong>
        </div>

        <div className="total">
          <span>Total</span>
          <strong>{peso(totalSavings)}</strong>
        </div>
      </section>

      <section className="card records-card">
        <div className="tabs">
          <button
            type="button"
            className={activeView === "Jec" ? "active" : ""}
            onClick={() => setActiveView("Jec")}
          >
            Jec
          </button>

          <button
            type="button"
            className={activeView === "Bel" ? "active" : ""}
            onClick={() => setActiveView("Bel")}
          >
            Bel
          </button>

          <button
            type="button"
            className={activeView === "All" ? "active" : ""}
            onClick={() => setActiveView("All")}
          >
            All
          </button>
        </div>

        <div className="records-header">
          <h2>{activeView} Records</h2>
          <p>{visibleRecords.length}</p>
        </div>

        {loading ? (
          <p className="empty">Loading...</p>
        ) : visibleRecords.length === 0 ? (
          <p className="empty">No records yet.</p>
        ) : (
          <div className="record-list">
            {visibleRecords.map((record) => (
              <div className="record-item" key={record.id}>
                <div className="record-details">
                  <strong>
                    {activeView === "All" ? record.person : "Savings"}
                  </strong>
                  <span>{formatDate(record.saved_at)}</span>
                </div>

                <div className="record-actions">
                  <p>{peso(record.amount)}</p>

                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => handleDelete(record)}
                    disabled={deletingId === record.id}
                  >
                    {deletingId === record.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;