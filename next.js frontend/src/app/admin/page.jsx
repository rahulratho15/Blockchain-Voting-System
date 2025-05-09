"use client";

import { useState, useEffect, useRef } from "react";
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  readContract
} from "thirdweb";
import { ConnectButton, useActiveAccount, useSendTransaction } from "thirdweb/react";
import { defineChain } from "thirdweb/chains";
import axios from "axios";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import 'bootstrap/dist/css/bootstrap.min.css';


// Icons (using simple text/icons instead of external dependencies)
const ClipboardCheckIcon = () => <span className="text-xl">📋</span>;
const UserIcon = () => <span className="text-xl">👤</span>;
const UserGroupIcon = () => <span className="text-xl">👥</span>;
const DocumentDownloadIcon = () => <span className="text-xl">📥</span>;
const ArrowPathIcon = () => <span className="text-xl">🔄</span>;
const ChartBarIcon = () => <span className="text-xl">📊</span>;
const PlusIcon = () => <span className="text-xl">➕</span>;
const TrashIcon = () => <span className="text-xl">🗑️</span>;
const CheckCircleIcon = () => <span className="text-xl">✅</span>;
const XCircleIcon = () => <span className="text-xl">❌</span>;

// Election states enum
const ElectionState = {
  NOT_STARTED: 0,
  ONGOING: 1,
  ENDED: 2
};

// Translated election state messages
const ElectionStateMessages = {
  0: "Not Started",
  1: "Election Ongoing",
  2: "Election Ended"
};

const Admin = () => {
  // Initialize ThirdWeb client
  const client = createThirdwebClient({
    clientId: "f6ba07193b19ed9857c4871a303bb536",
  });
  
  const contract = getContract({
    client,
    chain: defineChain(11155111),
    address: "0xEc1Feb91530B2239E0035BFFbC469D210B11F6f0",
  });
  const activeAccount = useActiveAccount();
  const { mutate: sendTransaction, isPending } = useSendTransaction();

  // Election state data
  const [electionState, setElectionState] = useState(0);
  const [electionStatus, setElectionStatus] = useState("Not Started");
  const [totalVoterCount, setTotalVoterCount] = useState(0);
  const [totalCandidateCount, setTotalCandidateCount] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [voters, setVoters] = useState([]);
  const [winners, setWinners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  // Form data
  const [newCandidateName, setNewCandidateName] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [selectedVoterToRemove, setSelectedVoterToRemove] = useState("");
  const [selectedCandidateToRemove, setSelectedCandidateToRemove] = useState("");

  // UI state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState("");

  // Refs
  const votingChartRef = useRef(null);
  const votingChartInstance = useRef(null);

  // Add this to your styles
  const styles = `
  .stat-card {
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: none;
    margin-bottom: 20px;
    background: white;
    overflow: hidden;
  }
  
  .stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  }
  
  .status-card {
    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
    color: white;
  }
  
  .voter-card {
    background: linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%);
    color: white;
  }
  
  .candidate-card {
    background: linear-gradient(135deg, #10B981 0%, #34D399 100%);
    color: white;
  }
  
  .action-card {
    background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%);
    color: white;
  }
  
  .chart-card {
    background: linear-gradient(135deg, #EC4899 0%, #F472B6 100%);
    color: white;
  }
  
  .tab-button {
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.3s ease;
  }
  
  .tab-button.active {
    background: #3B82F6;
    color: white;
  }
  
  .tab-button:not(.active) {
    background: #F3F4F6;
    color: #4B5563;
  }
  
  .tab-button:not(.active):hover {
    background: #E5E7EB;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    margin: 10px 0;
  }
  
  .stat-label {
    font-size: 0.875rem;
    opacity: 0.8;
  }
  
  .card-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 1.1rem;
  }
  
  .card-body {
    padding: 20px;
  }
  
  .action-button {
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: 600;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .primary-button {
    background: #3B82F6;
    color: white;
  }
  
  .primary-button:hover:not(:disabled) {
    background: #2563EB;
  }
  
  .success-button {
    background: #10B981;
    color: white;
  }
  
  .success-button:hover:not(:disabled) {
    background: #059669;
  }
  
  .danger-button {
    background: #EF4444;
    color: white;
  }
  
  .danger-button:hover:not(:disabled) {
    background: #DC2626;
  }
  
  .warning-button {
    background: #F59E0B;
    color: white;
  }
  
  .warning-button:hover:not(:disabled) {
    background: #D97706;
  }
  
  .status-badge {
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  .dashboard-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }
  `;

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Initial data load
  useEffect(() => {
    if (activeAccount?.address) {
      refreshDashboardData();
    }
  }, [activeAccount]);

  // Update connection status when activeAccount changes
  useEffect(() => {
    if (activeAccount?.address) {
      console.log("Connected address:", activeAccount.address);
    }
  }, [activeAccount]);

  // Refresh all dashboard data
  const refreshDashboardData = async () => {
    if (!contract || !activeAccount) return;
    
    setIsLoading(true);
    setMessage("Fetching latest blockchain data...");
    setMessageType("info");
    
    try {
      // Fetch election state
      await fetchElectionState();
      
      // Fetch counts
      await fetchVoterCount();
      await fetchCandidateCount();
      
      // Fetch detailed data
      await fetchCandidates();
      await fetchVoters();
      
      // If election ended, fetch winners
      if (electionState === ElectionState.ENDED) {
        await fetchWinners();
      }
      
      setMessage("Data refreshed successfully");
      setMessageType("success");
      
      // Update voting chart if in ongoing or ended state
      if (electionState === ElectionState.ONGOING || electionState === ElectionState.ENDED) {
        updateVotingChart();
      }
    } catch (error) {
      console.error("Error refreshing dashboard data:", error);
      setMessage(`Error: ${error.message}`);
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch election state from contract
  const fetchElectionState = async () => {
    try {
      const state = await readContract({
        contract,
        method: "function electionState() view returns (uint8)",
        params: [],
      });
      
      setElectionState(Number(state));
      
      const statusText = await readContract({
        contract,
        method: "function getElectionStatus() view returns (string)",
        params: [],
      });
      
      setElectionStatus(statusText || ElectionStateMessages[Number(state)]);
      
      return Number(state);
    } catch (error) {
      console.error("Error fetching election state:", error);
      throw error;
    }
  };

  // Fetch total voter count from contract
  const fetchVoterCount = async () => {
    try {
      const count = await readContract({
        contract,
        method: "function getTotalVoterCount() view returns (uint256)",
        params: [],
      });
      
      setTotalVoterCount(Number(count));
      return Number(count);
    } catch (error) {
      console.error("Error fetching voter count:", error);
      throw error;
    }
  };

  // Fetch total candidate count from contract
  const fetchCandidateCount = async () => {
    try {
      const count = await readContract({
        contract,
        method: "function getTotalCandidateCount() view returns (uint256)",
        params: [],
      });
      
      setTotalCandidateCount(Number(count));
      return Number(count);
    } catch (error) {
      console.error("Error fetching candidate count:", error);
      throw error;
    }
  };

  // Fetch candidates with vote counts
  const fetchCandidates = async () => {
    try {
      const candidateData = await readContract({
        contract,
        method: "function getVoteCounts() view returns ((uint256 id, string name, uint256 voteCount)[])",
        params: [],
      });
      
      setCandidates(candidateData || []);
      return candidateData;
    } catch (error) {
      console.error("Error fetching candidates:", error);
      throw error;
    }
  };

  // Fetch voters with voting status
  const fetchVoters = async () => {
    try {
      const voterData = await readContract({
        contract,
        method: "function getVoterVotingStatus() view returns ((uint256 voterID, string name, bool hasVoted)[])",
        params: [],
      });
      
      setVoters(voterData || []);
      return voterData;
    } catch (error) {
      console.error("Error fetching voters:", error);
      throw error;
    }
  };

  // Fetch election winners
  const fetchWinners = async () => {
    try {
      const winnerData = await readContract({
        contract,
        method: "function getWinner() view returns ((uint256 id, string name, string partyName)[])",
        params: [],
      });
      
      setWinners(winnerData || []);
      return winnerData;
    } catch (error) {
      console.error("Error fetching winners:", error);
      throw error;
    }
  };

  // Update the voting chart with latest candidate data
  const updateVotingChart = () => {
    if (!votingChartRef.current) return;
    
    // Destroy existing chart if it exists
    if (votingChartInstance.current) {
      votingChartInstance.current.destroy();
    }
    
    const ctx = votingChartRef.current.getContext('2d');
    
    // Format the data for the chart
    const labels = candidates.map(c => c.name);
    const data = candidates.map(c => Number(c.voteCount));
    
    // Create a new chart
    votingChartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Votes',
          data: data,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Votes'
            },
            ticks: {
              precision: 0 // Only show whole numbers
            }
          },
          x: {
            title: {
              display: true,
              text: 'Candidates'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Election Results',
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          }
        },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  };

  // Handle starting the election
  const handleStartElection = async () => {
    if (!contract || !activeAccount) {
      setMessage("Please connect your wallet first");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("Starting election process...");
      setMessageType("info");
      
      const transaction = prepareContractCall({
        contract,
        method: "function startElection()",
        params: [],
      });
      
      sendTransaction(transaction);
      
      setMessage("Election start transaction submitted. Please wait for confirmation.");
      setMessageType("success");
      
      // Wait a moment before refreshing to allow transaction to process
      setTimeout(refreshDashboardData, 5000);
    } catch (error) {
      console.error("Error starting election:", error);
      setMessage(`Error starting election: ${error.message}`);
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle ending the election
  const handleEndElection = async () => {
    if (!contract || !activeAccount) {
      setMessage("Please connect your wallet first");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("Ending election process...");
      setMessageType("info");
      
      const transaction = prepareContractCall({
        contract,
        method: "function endElection()",
        params: [],
      });
      
      sendTransaction(transaction);
      
      setMessage("Election end transaction submitted. Please wait for confirmation.");
      setMessageType("success");
      
      // Wait a moment before refreshing to allow transaction to process
      setTimeout(refreshDashboardData, 5000);
    } catch (error) {
      console.error("Error ending election:", error);
      setMessage(`Error ending election: ${error.message}`);
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle creating a new election (resets all data)
// Handle creating a new election (resets all data)
const handleNewElection = async () => {
  if (!contract || !activeAccount) {
    setMessage("Please connect your wallet first");
    setMessageType("error");
    return;
  }

  try {
    setIsLoading(true);
    setMessage("Creating new election...");
    setMessageType("info");
    
    const transaction = prepareContractCall({
      contract,
      method: "function newElection()",
      params: [],
    });
    
    sendTransaction(transaction);
    
    setMessage("New election setup transaction submitted. Please wait for confirmation.");
    setMessageType("success");
    
    // Reset local state
    setWinners([]);
    
    // Wait a moment before refreshing to allow transaction to process
    setTimeout(refreshDashboardData, 5000);
  } catch (error) {
    console.error("Error creating new election:", error);
    setMessage(`Error creating new election: ${error.message}`);
    setMessageType("error");
  } finally {
    setIsLoading(false);
  }
};

  // Handle candidate registration
  const handleRegisterCandidate = async (e) => {
    e.preventDefault();
    
    if (!contract || !activeAccount) {
      setMessage("Please connect your wallet first");
      setMessageType("error");
      return;
    }

    if (!newCandidateName.trim()) {
      setMessage("Please enter a candidate name");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);
      setMessage(`Registering candidate: ${newCandidateName}...`);
      setMessageType("info");
      
      const transaction = prepareContractCall({
        contract,
        method: "function registerCandidate(string name) returns (uint256)",
        params: [newCandidateName],
      });
      
      sendTransaction(transaction);
      
      setMessage(`Candidate registration submitted for: ${newCandidateName}`);
      setMessageType("success");
      
      // Clear form
      setNewCandidateName("");
      setNewPartyName("");
      
      // Wait a moment before refreshing to allow transaction to process
      setTimeout(refreshDashboardData, 5000);
    } catch (error) {
      console.error("Error registering candidate:", error);
      setMessage(`Error registering candidate: ${error.message}`);
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle removing a candidate
  const handleRemoveCandidate = async (candidateID) => {
    if (!contract || !activeAccount) {
      setMessage("Please connect your wallet first");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);
      setMessage(`Removing candidate ID: ${candidateID}...`);
      setMessageType("info");
      
      const transaction = prepareContractCall({
        contract,
        method: "function removeCandidate(uint256 candidateID)",
        params: [candidateID],
      });
      
      sendTransaction(transaction);
      
      setMessage(`Candidate removal submitted for ID: ${candidateID}`);
      setMessageType("success");
      
      // Wait a moment before refreshing to allow transaction to process
      setTimeout(refreshDashboardData, 5000);
    } catch (error) {
      console.error("Error removing candidate:", error);
      setMessage(`Error removing candidate: ${error.message}`);
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle removing a voter
// Handle removing a voter
const handleRemoveVoter = async (voterID) => {
  if (!contract || !activeAccount) {
    setMessage("Please connect your wallet first");
    setMessageType("error");
    return;
  }

  try {
    setIsLoading(true);
    setMessage(`Removing voter ID: ${voterID}...`);
    setMessageType("info");
    
    // 1. First remove from blockchain
    const transaction = prepareContractCall({
      contract,
      method: "function removeVoter(uint256 voterID)",
      params: [voterID],
    });
    
    await sendTransaction(transaction);
    
    // 2. Then remove from fingerprint sensor via API
    try {
      const response = await fetch(`http://localhost:5000/api/fingerprint/delete/${voterID}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMessage(`Voter ID ${voterID} removed from both blockchain and fingerprint system`);
        setMessageType("success");
      } else {
        setMessage(`Blockchain removal succeeded but fingerprint removal failed: ${result.message}`);
        setMessageType("warning");
      }
    } catch (apiError) {
      console.error("Error removing from fingerprint sensor:", apiError);
      setMessage(`Blockchain removal succeeded but fingerprint removal failed: ${apiError.message}`);
      setMessageType("warning");
    }
    
    setTimeout(refreshDashboardData, 5000);
  } catch (error) {
    console.error("Error removing voter:", error);
    setMessage(`Error removing voter: ${error.message}`);
    setMessageType("error");
  } finally {
    setIsLoading(false);
  }
};

  // Handle opening confirm dialog
  const openConfirmDialog = (action, message) => {
    setConfirmAction(() => action);  // Use function to prevent React capturing the function reference
    setConfirmMessage(message);
    setIsConfirmDialogOpen(true);
  };

  // Handle confirm dialog result
  const handleConfirmAction = async () => {
    setIsConfirmDialogOpen(false);
    if (confirmAction) {
      await confirmAction();
    }
  };

  // Generate and download election results PDF
  const generateElectionResultsPDF = async () => {
    try {
      setMessage("Generating election results PDF...");
      setMessageType("info");
      
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const { width, height } = page.getSize();
      
      // Get the standard font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Add title
      page.drawText('Election Results Report', {
        x: 50,
        y: height - 50,
        size: 24,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Add election status
      page.drawText(`Election Status: ${electionStatus}`, {
        x: 50,
        y: height - 100,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Add statistics
      page.drawText(`Total Registered Voters: ${totalVoterCount}`, {
        x: 50,
        y: height - 130,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      page.drawText(`Total Candidates: ${totalCandidateCount}`, {
        x: 50,
        y: height - 150,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      // Count voted and not voted
      const votedCount = voters.filter(v => v.hasVoted).length;
      
      page.drawText(`Total Votes Cast: ${votedCount}`, {
        x: 50,
        y: height - 170,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      const participationRate = totalVoterCount > 0 ? ((votedCount / totalVoterCount) * 100).toFixed(2) : 0;
      
      page.drawText(`Voter Participation: ${participationRate}%`, {
        x: 50,
        y: height - 190,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Add candidate results header
      page.drawText('Candidate Results', {
        x: 50,
        y: height - 230,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      // Add candidate results
      let yPos = height - 260;
      page.drawText('ID', { x: 50, y: yPos, size: 12, font: boldFont });
      page.drawText('Name', { x: 100, y: yPos, size: 12, font: boldFont });
      page.drawText('Votes', { x: 300, y: yPos, size: 12, font: boldFont });
      page.drawText('Percentage', { x: 400, y: yPos, size: 12, font: boldFont });
      
      yPos -= 20;
      
      const totalVotes = candidates.reduce((sum, candidate) => sum + Number(candidate.voteCount), 0);
      
      candidates.forEach((candidate, index) => {
        const votePercentage = totalVotes > 0 
          ? ((Number(candidate.voteCount) / totalVotes) * 100)
          .toFixed(2) 
          : '0.00';
          
        page.drawText(`${candidate.id.toString()}`, { x: 50, y: yPos, size: 12, font: font });
        page.drawText(candidate.name, { x: 100, y: yPos, size: 12, font: font });
        page.drawText(candidate.voteCount.toString(), { x: 300, y: yPos, size: 12, font: font });
        page.drawText(`${votePercentage}%`, { x: 400, y: yPos, size: 12, font: font });
        
        yPos -= 20;
      });

      // Add winners section if election has ended
      if (electionState === ElectionState.ENDED && winners.length > 0) {
        yPos -= 20;
        
        page.drawText('Election Winners', {
          x: 50,
          y: yPos,
          size: 16,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        
        yPos -= 30;
        
        winners.forEach((winner, index) => {
          page.drawText(`Winner ${index + 1}: ${winner.name} (ID: ${winner.id})`, { 
            x: 50, 
            y: yPos, 
            size: 12, 
            font: boldFont,
            color: rgb(0, 0.5, 0) 
          });
          
          yPos -= 20;
        });
      }

      // Add timestamp
      const now = new Date();
      page.drawText(`Report generated: ${now.toLocaleString()}`, {
        x: 50,
        y: 50,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Serialize the PDF to bytes
      const pdfBytes = await pdfDoc.save();
      
      // Create a blob from the PDF bytes
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      // Create a link element and trigger download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `election-results-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setMessage("Election results PDF downloaded successfully");
      setMessageType("success");
    } catch (error) {
      console.error("Error generating PDF:", error);
      setMessage(`Error generating PDF: ${error.message}`);
      setMessageType("error");
    }
  };

  // Calculate election statistics
  const calculateStats = () => {
    const votedCount = voters.filter(v => v.hasVoted).length;
    const notVotedCount = voters.length - votedCount;
    const participationRate = voters.length > 0 ? ((votedCount / voters.length) * 100).toFixed(2) : 0;
    
    return {
      votedCount,
      notVotedCount,
      participationRate
    };
  };

  const stats = calculateStats();

  // Render confirmation dialog
  const renderConfirmDialog = () => {
    if (!isConfirmDialogOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <h3 className="text-lg font-bold mb-4">Confirm Action</h3>
          <p className="mb-6">{confirmMessage}</p>
          <div className="flex justify-end space-x-3">
            <button
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              onClick={() => setIsConfirmDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-red-500 text-black rounded-lg hover:bg-red-600 transition-colors"
              onClick={handleConfirmAction}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render the dashboard tab
  const renderDashboard = () => {
    return (
      <div className="dashboard-container">
        {/* Status Card */}
        <div className="stat-card status-card">
          <div className="card-header">
            <ClipboardCheckIcon />
            Election Status
          </div>
          <div className="card-body">
            <div className="stat-value">{electionStatus}</div>
            
            <div className="mt-6 space-y-3">
              <button
                onClick={() => openConfirmDialog(handleStartElection, "Are you sure you want to start the election? This action cannot be undone.")}
                disabled={electionState !== ElectionState.NOT_STARTED || isLoading}
                className={`w-full action-button ${
                  electionState !== ElectionState.NOT_STARTED || isLoading 
                    ? 'bg-opacity-50 cursor-not-allowed' 
                    : 'success-button'
                }`}
              >
                Start Election
              </button>
              
              <button
                onClick={() => openConfirmDialog(handleEndElection, "Are you sure you want to end the election? This will finalize results and no more votes can be cast.")}
                disabled={electionState !== ElectionState.ONGOING || isLoading}
                className={`w-full action-button ${
                  electionState !== ElectionState.ONGOING || isLoading 
                    ? 'bg-opacity-50 cursor-not-allowed' 
                    : 'danger-button'
                }`}
              >
                End Election
              </button>
              
              <button
                onClick={() => openConfirmDialog(handleNewElection, "WARNING: This will delete ALL election data including voters, candidates, and results. This cannot be undone!")}
                disabled={electionState !== ElectionState.ENDED || isLoading}
                className={`w-full action-button ${
                  electionState !== ElectionState.ENDED || isLoading 
                    ? 'bg-opacity-50 cursor-not-allowed' 
                    : 'warning-button'
                }`}
              >
                Start New Election
              </button>
            </div>
          </div>
        </div>
        
        {/* Voter Stats Card */}
        <div className="stat-card voter-card">
          <div className="card-header">
            <UserIcon />
            Voter Statistics
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div>
                <div className="stat-label">Total Registered Voters</div>
                <div className="stat-value">{totalVoterCount}</div>
              </div>
              
              {electionState !== ElectionState.NOT_STARTED && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="stat-label">Voted</div>
                      <div className="stat-value">{stats.votedCount}</div>
                    </div>
                    <div>
                      <div className="stat-label">Not Voted</div>
                      <div className="stat-value">{stats.notVotedCount}</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="stat-label">Participation Rate</div>
                    <div className="stat-value">{stats.participationRate}%</div>
                    <div className="w-full bg-white bg-opacity-30 rounded-full h-3 mt-2">
                      <div 
                        className="bg-white h-3 rounded-full transition-all duration-500" 
                        style={{ width: `${stats.participationRate}%` }}
                      ></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Candidate Stats Card */}
        <div className="stat-card candidate-card">
          <div className="card-header">
            <UserGroupIcon />
            Candidate Statistics
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div>
                <div className="stat-label">Total Candidates</div>
                <div className="stat-value">{totalCandidateCount}</div>
              </div>
              
              {electionState === ElectionState.ENDED && winners.length > 0 && (
                <div>
                  <div className="stat-label">Winner(s)</div>
                  <div className="space-y-2 mt-2">
                    {winners.map((winner, index) => (
                      <div key={index} className="flex items-center gap-2 bg-black  bg-opacity-20 p-2 rounded-lg">
                        <CheckCircleIcon />
                        {winner.name} (ID: {winner.id})
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {electionState !== ElectionState.NOT_STARTED && (
                <button
                  onClick={generateElectionResultsPDF}
                  disabled={isLoading}
                  className="w-full mt-4 action-button primary-button disabled:bg-opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentDownloadIcon />
                  Download Report
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Action buttons - Refresh and Tab navigation */}
        <div className="stat-card col-span-1 md:col-span-3">
          <div className="card-body">
            <div className="flex flex-wrap gap-3 justify-between items-center">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
                >
                  <ChartBarIcon />
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("candidates")}
                  className={`tab-button ${activeTab === "candidates" ? "active" : ""}`}
                >
                  <UserGroupIcon />
                  Candidates
                </button>
                <button
                  onClick={() => setActiveTab("voters")}
                  className={`tab-button ${activeTab === "voters" ? "active" : ""}`}
                >
                  <UserIcon />
                  Voters
                </button>
              </div>
              
              <button
                onClick={refreshDashboardData}
                disabled={isLoading}
                className="action-button success-button disabled:bg-opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className={isLoading ? "animate-spin" : ""} />
                {isLoading ? "Refreshing..." : "Refresh Data"}
              </button>
            </div>
            
            {message && (
              <div className={`mt-4 p-3 rounded-md ${
                messageType === "success" 
                  ? "bg-green-100 text-green-800 border border-green-200" 
                  : messageType === "error" 
                  ? "bg-red-100 text-red-800 border border-red-200" 
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
        
        {/* Voting Results Chart - Only show if election is ongoing or ended */}
        {(electionState === ElectionState.ONGOING || electionState === ElectionState.ENDED) && (
          <div className="stat-card chart-card col-span-1 md:col-span-3">
            <div className="card-header">
              <ChartBarIcon />
              Live Voting Results
            </div>
            <div className="card-body">
              <div className="h-64 bg-white bg-opacity-10 p-3 rounded-lg">
                <canvas ref={votingChartRef} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  // Render the candidates tab
  const renderCandidates = () => {
    return (
      <div className="space-y-6">
        {/* Candidate Registration Form */}
        <div className="stat-card">
          <div className="card-header bg-gradient-to-r from-purple-500 to-blue-500 text-white">
            <PlusIcon />
            Register New Candidate
          </div>
          <div className="card-body">
            <form onSubmit={handleRegisterCandidate} className="space-y-4">
              <div>
                <label htmlFor="candidateName" className="block text-sm font-medium text-gray-700 mb-1">
                  Candidate Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="candidateName"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  placeholder="Enter candidate full name"
                  required
                />
              </div>
              

              
              <button
                type="submit"
                disabled={isLoading || !newCandidateName.trim() || electionState !== ElectionState.NOT_STARTED}
                className={`w-full action-button ${
                  isLoading || !newCandidateName.trim() || electionState !== ElectionState.NOT_STARTED
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "primary-button"
                }`}
              >
                <PlusIcon />
                Register Candidate
              </button>
              
              {electionState !== ElectionState.NOT_STARTED && (
                <p className="text-amber-600 text-sm mt-2">
                  Candidates can only be registered before the election starts.
                </p>
              )}
            </form>
          </div>
        </div>
        
        {/* Candidate List */}
        <div className="stat-card">
          <div className="card-header bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
            <UserGroupIcon />
            Candidates List
            <span className="ml-auto bg-white text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Total: {candidates.length}
            </span>
          </div>
          <div className="card-body">
            {candidates.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                No candidates registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      {electionState !== ElectionState.NOT_STARTED && (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Votes
                        </th>
                      )}
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {candidates.map((candidate) => (
                      <tr key={candidate.id.toString()} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {candidate.id.toString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidate.name}
                        </td>
                        {electionState !== ElectionState.NOT_STARTED && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {candidate.voteCount.toString()}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => openConfirmDialog(
                              () => handleRemoveCandidate(candidate.id), 
                              `Are you sure you want to remove candidate ${candidate.name}?`
                            )}
                            disabled={electionState !== ElectionState.NOT_STARTED}
                            className={`text-red-600 hover:text-red-900 transition-colors ${
                              electionState !== ElectionState.NOT_STARTED ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            title="Remove candidate"
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Render the voters tab
  const renderVoters = () => {
    return (
      <div className="stat-card">
        <div className="card-header bg-gradient-to-r from-green-500 to-emerald-500 text-white">
          <UserIcon />
          Registered Voters
          <span className="ml-auto bg-white text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            Total: {voters.length}
          </span>
        </div>
        <div className="card-body">
          {voters.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              No voters registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Voting Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {voters.map((voter) => (
                    <tr key={voter.voterID.toString()} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {voter.voterID.toString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {voter.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`status-badge ${
                          voter.hasVoted 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {voter.hasVoted ? (
                            <span className="flex items-center gap-1">
                              <CheckCircleIcon />
                              Voted
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircleIcon />
                              Not Voted
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => openConfirmDialog(
                            () => handleRemoveVoter(voter.voterID), 
                            `Are you sure you want to remove voter ${voter.name}?`
                          )}
                          disabled={electionState !== ElectionState.NOT_STARTED}
                          className={`text-red-600 hover:text-red-900 transition-colors ${
                            electionState !== ElectionState.NOT_STARTED ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          title="Remove voter"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mt-4 py-6 px-4">
      {/* Header with Admin Dashboard title and Wallet Connect button */}
      <div className="max-w-7xl mx-auto mb-6">
      <div className="stat-card bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="p-6 flex flex-col md:flex-row justify-between items-center">
          <div>
            <h1 style={{color:"black"}} className="text-2xl md:text-3xl font-bold text-gray-900">Election Admin Dashboard</h1>
            <p style={{color:"black"}} className="text-sm opacity-80 mt-1 font-bold text-gray-900">Manage election process and view results</p>
          </div>
  
            <ConnectButton client={client} className="!bg-white !text-indigo-700 hover:!bg-gray-100" />
          
        </div>
      </div>
    </div>
      
      {/* Main content */}
      <div className="max-w-7xl mx-auto">
      {!activeAccount ? (
        <div className="stat-card">
          <div className="card-body text-center py-12">
            <div className="mb-4 text-5xl">🔒</div>
            <h2 className="text-2xl font-medium text-gray-900 mb-2">Admin Authentication Required</h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              Please connect your wallet to access the admin dashboard. Only authorized admin wallets can perform election management.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "candidates" && renderCandidates()}
          {activeTab === "voters" && renderVoters()}
        </div>
      )}
    </div>
      
      {/* Confirmation Dialog */}
      {renderConfirmDialog()}
      </div>
  );
}

export default Admin;