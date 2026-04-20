import { useState, useEffect } from 'react';
import { Wallet, LineChart, PlusCircle, HandCoins, ExternalLink } from 'lucide-react';
import './index.css';

import { connectKit } from './stellar/wallet';
import { getActiveLoans, requestLoan, fundLoan } from './stellar/contract';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [address, setAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [loans, setLoans] = useState([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txTargetInfo, setTxTargetInfo] = useState('');

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formInterest, setFormInterest] = useState('');
  const [formDuration, setFormDuration] = useState('');

  const fetchLoans = async () => {
    setIsLoadingLoans(true);
    const res = await getActiveLoans();
    if (res.success) {
      setLoans(res.loans);
    }
    setIsLoadingLoans(false);
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    const res = await connectKit();
    if (res.success) {
      setAddress(res.publicKey);
    } else {
      console.log("Wallet kit closed");
    }
    setIsConnecting(false);
  };

  const handleRequestLoan = async (e) => {
    e.preventDefault();
    if (!address) return alert("Please connect your wallet first.");
    if (!formTitle || !formAmount || !formInterest || !formDuration) return;

    setIsSubmitting(true);
    const res = await requestLoan(formTitle, formAmount, formInterest, formDuration, address);
    if (res.success) {
      alert("Loan request created successfully via Soroban!");
      setFormTitle('');
      setFormAmount('');
      setFormInterest('');
      setFormDuration('');
      fetchLoans();
      setActiveTab('dashboard');
    } else {
      alert(res.error);
    }
    setIsSubmitting(false);
  };

  const handleFund = async (loanId) => {
    if (!address) return alert("Please connect your wallet first to fund.");
    
    setTxTargetInfo(loanId);
    
    // Find the loan to get its amount
    const loanToFund = loans.find(l => l.id === loanId);
    if (!loanToFund) return alert("Loan not found.");

    const res = await fundLoan(loanId, loanToFund.amount, address);
    if (res.success) {
      alert(`Loan ${loanId} funded successfully! Transaction signed.`);
      fetchLoans();
    } else {
      alert("Funding failed or loan is already active");
    }
    setTxTargetInfo('');
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="logo">
          <HandCoins size={28} />
          LendFlare
        </div>
        <div>
          {address ? (
            <div className="badge badge-active" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', display: 'flex', gap: '8px', alignItems:'center'}}>
               <div style={{width:'8px',height:'8px', borderRadius:'50%', background:'var(--accent)'}}></div>
               {address.substring(0, 5)}...{address.substring(address.length - 4)}
            </div>
          ) : (
            <button className="btn btn-primary" onClick={handleConnectWallet} disabled={isConnecting}>
              {isConnecting ? <div className="loader"></div> : <><Wallet size={18} /> Connect Wallet</>}
            </button>
          )}
        </div>
      </nav>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LineChart size={18} /> Active Loans
        </button>
        <button 
          className={`btn ${activeTab === 'request' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('request')}
        >
          <PlusCircle size={18} /> Request Loan
        </button>
      </div>

      <main>
        {activeTab === 'dashboard' && (
          <section>
            <h2>Available Opportunities</h2>
            <p className="text-muted">High-yield micro-loans secured by Soroban smart contracts.</p>
            
            {isLoadingLoans ? (
              <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
                <div className="loader" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
              </div>
            ) : (
              <div className="dashboard-grid">
                {loans.map(loan => (
                  <div className="glass-card" key={loan.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap:'0.5rem' }}>
                        {loan.title}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{loan.id}</span>
                      </h3>
                      <span className={`badge ${loan.status === 'active' ? 'badge-active' : 'badge-pending'}`}>
                        {loan.status}
                      </span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <span className="text-muted">Target Amount</span>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{loan.amount} XLM</div>
                      </div>
                      <div>
                        <span className="text-muted">Interest Rate</span>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)' }}>{loan.interest}%</div>
                      </div>
                      <div>
                        <span className="text-muted">Duration</span>
                        <div style={{ fontWeight: '500' }}>{loan.duration} Days</div>
                      </div>
                      <div>
                        <span className="text-muted">Funded</span>
                        <div style={{ fontWeight: '500' }}>{loan.funded} XLM</div>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <span className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                        Borrower: {loan.borrower.substring(0,6)}...{loan.borrower.substring(loan.borrower.length - 4)} <ExternalLink size={14}/>
                      </span>
                    </div>

                    <button 
                      className={`btn ${loan.status === 'active' ? 'btn-outline' : 'btn-primary'}`} 
                      style={{ width: '100%', opacity: loan.status === 'active' ? 0.5 : 1 }}
                      onClick={() => handleFund(loan.id)}
                      disabled={loan.status === 'active' || txTargetInfo === loan.id}
                    >
                      {txTargetInfo === loan.id ? <div className="loader"></div> : (loan.status === 'active' ? 'Fully Funded' : 'Fund Loan')}
                    </button>
                  </div>
                ))}
                
                {loans.length === 0 && (
                   <p className="text-muted">No loans currently available.</p>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'request' && (
          <section className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2>Request a Loan</h2>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Create a new smart-contract backed loan request.</p>
            
            <form onSubmit={handleRequestLoan}>
              <div className="input-group">
                <label>Loan Purpose / Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g., Equipment Purchase" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label>Amount (XLM)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="0.0" 
                    min="1"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Interest Rate (%)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="5" 
                    min="0"
                    max="100"
                    value={formInterest}
                    onChange={(e) => setFormInterest(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
              
              <div className="input-group">
                <label>Duration (Days)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  placeholder="30" 
                  min="1"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', margin: '1rem 0 0 0' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? <div className="loader"></div> : 'Submit Request to Soroban'}
              </button>
            </form>
            
            {!address && (
              <p className="text-muted" style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>
                You must connect your wallet to submit a request.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
