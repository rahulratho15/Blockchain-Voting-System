"use client";

import { useState, useEffect, useRef } from "react";
import {
  createThirdwebClient,
  getContract,
  readContract,
  prepareContractCall,
} from "thirdweb";
import { ConnectButton, useActiveAccount, useSendTransaction } from "thirdweb/react";
import { defineChain } from "thirdweb/chains";
import axios from "axios";

export default function VoteCasting() {
  // State variables
  const [voterId, setVoterId] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState("login"); // login, verification, voting, success
  const [voterData, setVoterData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [faceDisabled, setFaceDisabled] = useState(false);
  const [fingerDisabled, setFingerDisabled] = useState(false);
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [fingerprintScanned, setFingerprintScanned] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [allVoters, setAllVoters] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  let stream = null;
  
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
  
  // Load voter and candidate data on initial load
  useEffect(() => {
    fetchAllData();
  }, []);
  
  // Fetch both candidate and voter data from blockchain
  const fetchAllData = async () => {
    try {
      setMessage("Loading data from blockchain...");
      setIsLoadingData(true);
      
      // Fetch all voters from blockchain
      const votersResponse = await readContract({
        contract,
        method: "function getAllVoters() view returns ((uint256 id, string name, string faceEncoding, string fingerEncoding, bool faceDisabled, bool fingerDisabled, bool hasVoted)[])",
        params: [],
      });
      
      // Fetch all candidates from blockchain
      const candidatesResponse = await readContract({
        contract,
        method: "function getAllCandidates() view returns ((uint256 id, string name, uint256 voteCount)[])",
        params: [],
      });
      
      if (votersResponse) {
        setAllVoters(votersResponse);
        console.log("All voters:", votersResponse);
      }
      
      if (candidatesResponse) {
        setCandidates(candidatesResponse);
        console.log("All candidates:", candidatesResponse);
      }
      
      setMessage("");
    } catch (error) {
      console.error("Error fetching data from blockchain:", error);
      setMessage("Failed to load data from blockchain. Please ensure you are connected to the correct network.");
    } finally {
      setIsLoadingData(false);
    }
  };
  
  // Authenticate voter by ID
  const authenticateVoter = async (e) => {
    e.preventDefault();
    
    if (!voterId.trim()) {
      setMessage("Please enter your Voter ID");
      return;
    }
    
    setIsAuthenticating(true);
    setMessage("Authenticating...");
    
    try {
      // Find voter in the list by ID number
      const voter = allVoters.find(v => v.id.toString() === voterId);
      
      if (!voter) {
        setMessage("Voter ID not found. Please check and try again.");
        setIsAuthenticating(false);
        return;
      }
      
      // Check if voter has already voted
      if (voter.hasVoted) {
        setMessage("You have already cast your vote in this election.");
        setIsAuthenticating(false);
        return;
      }
      
      // Set voter data and move to verification step
      setVoterData(voter);
      setFaceDisabled(voter.faceDisabled);
      setFingerDisabled(voter.fingerDisabled);
      setStep("verification");
      setMessage("");
      
    } catch (error) {
      console.error("Authentication error:", error);
      setMessage("Authentication failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  // Start webcam when capture face button is clicked
  const startWebcam = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
      setMessage("Could not access webcam");
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Capture image from webcam
  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setMessage("Video stream not available");
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob
    try {
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, "image/jpeg", 0.95);
      });
      
      // Create file from blob
      const imageFile = new File([blob], "face-capture.jpg", { type: "image/jpeg" });
      
      // Send to face verification API
      await verifyFace(imageFile);
      
      // Stop webcam after capturing
      stopWebcam();
    } catch (error) {
      console.error("Error capturing image:", error);
      setMessage("Failed to capture image");
    }
  };
  const getFaceEncodingFromImage = async (imageFile) => {
    const formData = new FormData();
    formData.append("file", imageFile);
    
    const response = await axios.post("http://localhost:5000/api/encode_face", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    
    if (response.data.success) {
      return response.data.data.encoding;
    } else {
      throw new Error("Failed to encode face");
    }
  };
  // Verify face against stored encoding
  const verifyFace = async (imageFile) => {
    try {
      setMessage("Verifying face...");
      
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("storedEncoding", voterData.faceEncoding);
      formData.append("threshold", "0.6"); // Threshold for face matching (adjust as needed)
      
      const response = await axios.post("http://localhost:5000/api/face/compare", {
        encoding1: JSON.parse(voterData.faceEncoding),
        encoding2: await getFaceEncodingFromImage(imageFile),
        threshold: 0.6
      });
      
      if (response.data.success && response.data.data.is_match) {
        setMessage("Face verification successful");
        setFaceCaptured(true);
      } else {
        setMessage(`Face verification failed: ${response.data.message || "No match found"}`);
      }
    } catch (error) {
      console.error("Error verifying face:", error);
      setMessage("Failed to verify face");
    }
  };

  // Initialize fingerprint scanner
  const initFingerprintScanner = async () => {
    try {
      setMessage("Initializing fingerprint scanner...");
      
      const response = await axios.post("http://localhost:5000/api/fingerprint/init", {
        port: "COM16" // Adjust port as needed
      });
      
      if (response.data.success) {
        setMessage("Fingerprint scanner initialized");
        return true;
      } else {
        setMessage(`Failed to initialize scanner: ${response.data.message}`);
        return false;
      }
    } catch (error) {
      console.error("Error initializing fingerprint scanner:", error);
      setMessage("Failed to connect to fingerprint scanner");
      return false;
    }
  };

  // Verify fingerprint
  const verifyFingerprint = async () => {
    try {
      // First initialize the scanner
      const initialized = await initFingerprintScanner();
      
      if (!initialized) {
        return;
      }
      
      setMessage("Please place your finger on the scanner...");
      
      // Verify fingerprint
      const response = await axios.post("http://localhost:5000/api/fingerprint/verify");
      console.log(response)

      if (response.data.success && 
          response.data.data.is_match && 
          response.data.data.voter_id.toString() === voterId) {
        setMessage("Fingerprint verification successful");
        setFingerprintScanned(true);
      }  else {
        setMessage(`Fingerprint verification failed: ${response.data.message || "No match found"}`);
        setFingerprintScanned(false);
      }
    } catch (error) {
      console.error("Error verifying fingerprint:", error);
      setMessage("Failed to verify fingerprint");
    }
  };

  // Check if verification is complete
  const isVerificationComplete = () => {
    return (faceCaptured || faceDisabled) && (fingerprintScanned || fingerDisabled);
  };
  
  // Move to voting stepset
  const proceedToVoting = () => {
    if (isVerificationComplete()) {
      setStep("voting");
      setMessage("");
    } else {
      setMessage("Please complete all verification steps");
    }
  };
  
  // Select a candidate
  const selectCandidate = (candidate) => {
    setSelectedCandidate(candidate);
  };
  
  // Reset candidate selection
  const resetSelection = () => {
    setSelectedCandidate(null);
  };
  
  // Cast vote
  const castVote = async () => {
    if (!selectedCandidate || !voterData || !activeAccount?.address) {
      setMessage("Please select a candidate and ensure you are connected to wallet");
      return;
    }
    
    try {
      setIsSubmittingVote(true);
      setMessage("Submitting your vote to blockchain...");
      const voterIdBigInt = BigInt(voterId);
      const candidateIdBigInt = BigInt(selectedCandidate.id);
      
      console.log("Casting vote with:", voterIdBigInt, candidateIdBigInt);
      
      const transaction = prepareContractCall({
        contract,
        method: "function castVote(uint256 voterID, uint256 candidateID)",
        params: [voterIdBigInt, candidateIdBigInt],
      });
      
      sendTransaction(transaction);
      console.log("Vote submitted to blockchain");
      
      // Move to success step
      setStep("success");
      setMessage("Your vote has been submitted successfully!");
      
    } catch (error) {
      console.error("Error casting vote:", error);
      setMessage(`Vote submission failed: ${error.message}`);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);
  
  const onClickB = () => {
    const transaction = prepareContractCall({
      contract,
      method:
        "function castVote(uint256 voterID, uint256 candidateID)",
      params: [15, 1],
    });
    sendTransaction(transaction);
  };

  // Render login step
  const renderLoginStep = () => (
    <div className="transition-all duration-300">
      <h2 className="text-2xl font-bold mb-6 text-center">Voter Authentication</h2>
      
      <form onSubmit={authenticateVoter} className="space-y-6">
        <div className="mb-4">
          <label htmlFor="voterId" className="form-label block mb-2 text-sm font-medium">
            Voter ID (e.g., Aadhaar, SSN, National ID)
          </label>
          <input
            type="text"
            id="voterId"
            className="form-control form-control-lg w-full py-3 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
            placeholder="Enter your ID number"
            value={voterId}
            onChange={(e) => setVoterId(e.target.value)}
            required
          />
        </div>
        
        <button
          type="submit"
          className="btn btn-primary w-full py-3 px-6 rounded-lg font-medium text-white hover:bg-blue-600 transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isAuthenticating || !voterId.trim()}
        >
          {isAuthenticating ? "Authenticating..." : "Authenticate"}
        </button>
      </form>
    </div>
  );
  
  // Render verification step
  const renderVerificationStep = () => (
    <div className="transition-all duration-300">
      <h2 className="text-2xl font-bold mb-6 text-center">Identity Verification</h2>
      
      <div className="mb-6 p-5 bg-light rounded-lg shadow-sm border">
        <p className="font-semibold">Voter ID: {voterId}</p>
        {voterData && <p className="text-muted mt-1">Please complete the verification steps below</p>}
      </div>
      
      <div className="mb-6 row g-3">
        <div className="col-md-6">
          <button
            type="button"
            className={`btn w-100 p-4 d-flex flex-column align-items-center justify-content-center gap-3 ${
              faceDisabled || faceCaptured 
                ? 'btn-secondary' 
                : 'btn-primary'
            }`}
            onClick={startWebcam}
            disabled={faceDisabled || faceCaptured}
          >
            <span className="font-medium">Verify Face</span>
          </button>
        </div>
        
        <div className="col-md-6">
          <button
            type="button"
            className={`btn w-100 p-4 d-flex flex-column align-items-center justify-content-center gap-3 ${
              fingerDisabled || fingerprintScanned 
                ? 'btn-secondary' 
                : 'btn-primary'
            }`}
            onClick={verifyFingerprint}
            disabled={fingerDisabled || fingerprintScanned}
          >
            <span className="font-medium">Verify Fingerprint</span>
          </button>
        </div>
      </div>
      
      {/* Hidden video elements for face capture */}
      <div className={`mb-6 ${videoRef.current ? 'block' : 'hidden'}`}>
        <div className="ratio ratio-16x9 bg-dark rounded mb-3 border-2 border-primary">
          <video 
            ref={videoRef}
            autoPlay 
            muted 
            className="object-cover"
          ></video>
        </div>
        
        <button
          type="button"
          className="btn btn-success w-100 mt-3 py-3 px-6"
          onClick={captureImage}
        >
          Capture Now
        </button>
        
        <canvas ref={canvasRef} className="hidden"></canvas>
      </div>
      
      {/* Status indicators */}
      <div className="mt-4 row g-2 mb-4">
        <div className="col-md-6">
          <div className={`p-3 rounded text-center ${
            faceCaptured || faceDisabled 
              ? "bg-success bg-opacity-10 text-success" 
              : "bg-light text-muted"
          }`}>
            <span className="font-medium">Face: {faceDisabled ? "Disability Exemption" : (faceCaptured ? "Verified" : "Not Verified")}</span>
          </div>
        </div>
        <div className="col-md-6">
          <div className={`p-3 rounded text-center ${
            fingerprintScanned || fingerDisabled 
              ? "bg-success bg-opacity-10 text-success" 
              : "bg-light text-muted"
          }`}>
            <span className="font-medium">Fingerprint: {fingerDisabled ? "Disability Exemption" : (fingerprintScanned ? "Verified" : "Not Verified")}</span>
          </div>
        </div>
      </div>
      
      <div className="row mt-4 g-2">
        <div className="col-md-6">
          <button
            type="button"
            className="btn btn-secondary w-100 py-3 px-6"
            onClick={() => {
              stopWebcam();
              setStep("login");
              setVoterData(null);
              setFaceCaptured(false);
              setFingerprintScanned(false);
            }}
          >
            Back
          </button>
        </div>
        <div className="col-md-6">
          <button
            type="button"
            className={`btn w-100 py-3 px-6 ${
              isVerificationComplete() 
                ? 'btn-success' 
                : 'btn-secondary'
            }`}
            onClick={proceedToVoting}
            disabled={!isVerificationComplete()}
          >
            Proceed to Voting
          </button>
        </div>
      </div>
    </div>
  );
  
  // Render voting step
  const renderVotingStep = () => (
    <div className="transition-all duration-300">
      <h2 className="text-2xl font-bold mb-6 text-center">Cast Your Vote</h2>
      
      <div className="mb-6 p-5 bg-light rounded-lg shadow-sm border">
        <p className="font-semibold">Voter ID: {voterId}</p>
        <p className="text-muted mt-1">Please select one candidate to cast your vote</p>
      </div>
      
      <div className="mb-8">
        <h3 className="font-semibold mb-4">Available Candidates:</h3>
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <div 
              key={candidate.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                selectedCandidate && selectedCandidate.id === candidate.id 
                  ? 'border-primary bg-light shadow-md' 
                  : 'border-gray-200 hover:border-primary hover:shadow-sm'
              }`}
              onClick={() => selectCandidate(candidate)}
            >
              <div className="d-flex align-items-center">
                <div className={`form-check me-3`}>
                  <input
                    type="radio"
                    className="form-check-input"
                    checked={selectedCandidate && selectedCandidate.id === candidate.id}
                    onChange={() => {}}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div>
                  <p className="font-medium">{candidate.name}</p>
                  <p className="text-sm text-muted">ID: {candidate.id}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="row g-2">
        <div className="col-md-4">
          <button
            type="button"
            className="btn btn-secondary w-100 py-3 px-6"
            onClick={() => {
              setStep("verification");
              setSelectedCandidate(null);
            }}
          >
            Back
          </button>
        </div>
        
        {selectedCandidate && (
          <div className="col-md-4">
            <button
              type="button"
              className="btn btn-warning w-100 py-3 px-6"
              onClick={resetSelection}
            >
              Reset Choice
            </button>
          </div>
        )}
        
        <div className={selectedCandidate ? "col-md-4" : "col-md-8"}>
          <button
            type="button"
            className={`btn w-100 py-3 px-6 ${
              selectedCandidate && !isSubmittingVote 
                ? 'btn-success' 
                : 'btn-secondary'
            }`}
            onClick={castVote}
            disabled={!selectedCandidate || isSubmittingVote}
          >
            {isSubmittingVote ? "Submitting..." : "Cast Vote"}
          </button>
        </div>
      </div>
    </div>
  );
  
  // Render success step
  const renderSuccessStep = () => (
    <div className="text-center transition-all duration-300">
      <div className="mb-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-success d-flex align-items-center justify-content-center shadow-lg">
          <span className="text-white fw-bold fs-2">✓</span>
        </div>
      </div>
      
      <h2 className="text-3xl font-bold mb-3 text-success">Vote Cast Successfully!</h2>
      <p className="mb-8 text-muted">Thank you for participating in this election. Your vote has been recorded.</p>
      
      {selectedCandidate && (
        <div className="mb-8 p-5 bg-success bg-opacity-10 rounded-lg shadow-sm border border-success text-left">
          <p className="font-medium text-muted">You voted for:</p>
          <p className="text-xl font-bold mt-1">{selectedCandidate.name}</p>
        </div>
      )}
      
      <button
        type="button"
        className="btn btn-primary w-100 py-3 px-6"
        onClick={() => window.location.reload()}
      >
        Return to Start
      </button>
    </div>
  );

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8 col-md-10">
          <div className="card shadow-lg">
            <div className="card-header bg-primary text-white">
              <h1 className="mb-0">Secure Voting</h1>
            </div>
            
            <div className="card-body">
              <div className="d-flex justify-content-center mb-4">
                <ConnectButton client={client} className="btn btn-outline-primary" />
              </div>
              
              {message && (
                <div className={`alert ${
                  message.includes("success") || message.includes("successful") 
                    ? "alert-success" 
                    : "alert-warning"
                } mb-4`}>
                  {message}
                </div>
              )}
              
              {isLoadingData ? (
                <div className="d-flex flex-column align-items-center justify-content-center py-8">
                  <div className="spinner-border text-primary mb-4" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted font-medium">Loading blockchain data...</p>
                </div>
              ) : (
                <>
                  {step === "login" && renderLoginStep()}
                  {step === "verification" && renderVerificationStep()}
                  {step === "voting" && renderVotingStep()}
                  {step === "success" && renderSuccessStep()}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}