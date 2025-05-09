"use client";

import { useState, useEffect, useRef } from "react";
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
} from "thirdweb";
import { ConnectButton, useActiveAccount, useSendTransaction } from "thirdweb/react";
import { defineChain } from "thirdweb/chains";
import axios from "axios";

export default function VoterRegistration() {
  const [fullName, setFullName] = useState("");
  const [voterID, setVoterID] = useState("");
  const [faceDisabled, setFaceDisabled] = useState(false);
  const [fingerDisabled, setFingerDisabled] = useState(false);
  const [faceEncoding, setFaceEncoding] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [fingerprintScanned, setFingerprintScanned] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  let stream = null;
  
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
  
  useEffect(() => {
    if (activeAccount?.address) {
      //console.log("Connected address:", activeAccount.address);
    }
  }, [activeAccount]);

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

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setMessage("Video stream not available");
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, "image/jpeg", 0.95);
      });
      
      const imageFile = new File([blob], "face-capture.jpg", { type: "image/jpeg" });
      
      await sendImageForEncoding(imageFile);
      
      stopWebcam();
    } catch (error) {
      console.error("Error capturing image:", error);
      setMessage("Failed to capture image");
    }
  };

  const sendImageForEncoding = async (imageFile) => {
    try {
      setMessage("Processing face image...");
      
      const formData = new FormData();
      formData.append("file", imageFile);
      
      const response = await axios.post("http://localhost:5000/api/encode_face", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setFaceEncoding(response.data.data.encoding.join(", "));
      //console.log("e", faceEncoding);
      
      if (response.data.success) {
        setFaceEncoding(JSON.stringify(response.data.data.encoding));
        setMessage("Face captured successfully");
        setFaceCaptured(true);
      } else {
        setMessage(`Face capture failed: ${response.data.message}`);
      }
    } catch (error) {
      console.error("Error sending image for encoding:", error);
      setMessage("Failed to process face image");
    }
  };

  const initFingerprintScanner = async () => {
    try {
      setMessage("Initializing fingerprint scanner...");
      
      const response = await axios.post("http://localhost:5000/api/fingerprint/init", {
        port: "COM16"
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

  const generateUniqueFingerEncoding = () => {
    const prefix = "FPR100000000012C0003FFFF0080E100000104DF000C38D8";
    const uniquePart = Array(20).fill()
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('');
    const suffix = "26313c47";
    return `${prefix}${uniquePart}${suffix}`;
  };

  const [fingerEncoding, setFingerEncoding] = useState(generateUniqueFingerEncoding());

  const scanFingerprint = async () => {
    try {
      const initialized = await initFingerprintScanner();
      
      if (!initialized) {
        return;
      }
      
      setMessage("Please place your finger on the scanner...");
      
      const response = await axios.post("http://localhost:5000/api/fingerprint/register", {
        voter_id: voterID,
        voter_name: fullName
      });
      
      if (response.data.success) {
        setFingerEncoding(response.data.fingerprint_encoding || fingerEncoding);
        setMessage("Fingerprint registered successfully");
        setFingerprintScanned(true);
      } else {
        setMessage(`Fingerprint registration failed: ${response.data.message}`);
      }
    } catch (error) {
      console.error("Error registering fingerprint:", error);
      setMessage("Failed to register fingerprint");
    }
  };

  const canRegister = () => {
    return Boolean(
      fullName && 
      voterID && 
      activeAccount?.address && 
      (faceCaptured || faceDisabled) && 
      (fingerprintScanned || fingerDisabled)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canRegister()) {
      setMessage("Please complete all required fields");
      return;
    }
    
    try {
      setIsRegistering(true);
      setMessage("Preparing to register on blockchain...");
      
      const transaction = prepareContractCall({
        contract,
        method:
          "function registerVoter(string name, uint256 voterID, string faceEncoding, string fingerEncoding, bool faceDisabled, bool fingerDisabled)",
        params: [
          fullName,
          parseInt(voterID),
          faceEncoding,
          fingerEncoding,
          faceDisabled,
          fingerDisabled,
        ],
      });
      sendTransaction(transaction);
      //console.log("Registration submitted to blockchain");
      setMessage("Registration submitted to blockchain. Please wait for confirmation.");
      
      setTimeout(() => {
        setIsRegistering(false);
      }, 3000);
      
    } catch (error) {
      console.error("Error submitting registration:", error);
      setMessage(`Registration failed: ${error.message}`);
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8 col-md-10">
          <div className="card shadow-lg">
            <div className="card-header bg-primary text-white">
              <h2 className="mb-0">Voter Registration</h2>
            </div>
            
            <div className="card-body">
              <div className="d-flex justify-content-center mb-4">
                <ConnectButton client={client} className="btn btn-outline-light" />
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="fullName" className="form-label">Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    className="form-control form-control-lg"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="voterID" className="form-label">
                    Voter ID (e.g., Aadhaar, SSN, National ID)
                  </label>
                  <input
                    type="text"
                    id="voterID"
                    className="form-control form-control-lg"
                    placeholder="Enter your ID number"
                    value={voterID}
                    onChange={(e) => setVoterID(e.target.value)}
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <h5 className="mb-3">Disability Accommodations</h5>
                  <div className="form-check form-switch mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      role="switch"
                      id="fingerDisabled"
                      checked={fingerDisabled}
                      onChange={(e) => {
                        setFingerDisabled(e.target.checked);
                        if (e.target.checked) {
                          setFingerprintScanned(true);
                        } else {
                          setFingerprintScanned(false);
                        }
                      }}
                    />
                    <label className="form-check-label" htmlFor="fingerDisabled">
                      Hand/Fingerprint Disability
                    </label>
                  </div>
                  
                  <div className="form-check form-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      role="switch"
                      id="faceDisabled"
                      checked={faceDisabled}
                      onChange={(e) => {
                        setFaceDisabled(e.target.checked);
                        if (e.target.checked) {
                          setFaceCaptured(true);
                        } else {
                          setFaceCaptured(false);
                        }
                      }}
                    />
                    <label className="form-check-label" htmlFor="faceDisabled">
                      Face Recognition Disability
                    </label>
                  </div>
                </div>
                
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <button
                      type="button"
                      className={`btn w-100 ${faceDisabled ? 'btn-secondary' : 'btn-primary'} d-flex align-items-center justify-content-center gap-2`}
                      onClick={startWebcam}
                      disabled={faceDisabled || isRegistering}
                    >
                      <i className="bi bi-camera"></i>
                      Capture Face
                    </button>
                  </div>
                  <div className="col-md-6">
                    <button
                      type="button"
                      className={`btn w-100 ${fingerDisabled ? 'btn-secondary' : 'btn-primary'} d-flex align-items-center justify-content-center gap-2`}
                      onClick={scanFingerprint}
                      disabled={fingerDisabled || isRegistering}
                    >
                      <i className="bi bi-fingerprint"></i>
                      Scan Fingerprint
                    </button>
                  </div>
                </div>
                
                <div className={`mb-4 ${videoRef.current?.srcObject ? 'block' : 'd-none'}`}>
                  <div className="ratio ratio-16x9 bg-dark rounded mb-3">
                    <video 
                      ref={videoRef}
                      autoPlay 
                      muted 
                      className="object-cover"
                    ></video>
                  </div>
                  
                  <button
                    type="button"
                    className="btn btn-success w-100"
                    onClick={captureImage}
                  >
                    <i className="bi bi-camera-fill me-2"></i>
                    Capture Now
                  </button>
                  
                  <canvas ref={canvasRef} className="d-none"></canvas>
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
                
                <button
                  type="submit"
                  className={`btn w-100 btn-lg ${
                    canRegister() && !isRegistering 
                      ? 'btn-success' 
                      : 'btn-secondary'
                  }`}
                  disabled={!canRegister() || isRegistering}
                >
                  {isRegistering ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Registering...
                    </>
                  ) : (
                    "Register as Voter"
                  )}
                </button>
                
                <div className="row mt-4 g-2">
                  <div className="col-md-6">
                    <div className={`p-3 rounded text-center ${
                      faceCaptured || faceDisabled 
                        ? "bg-success bg-opacity-10 text-success" 
                        : "bg-light text-muted"
                    }`}>
                      <i className={`bi ${
                        faceDisabled 
                          ? "bi-person-x-fill" 
                          : faceCaptured 
                            ? "bi-person-check-fill" 
                            : "bi-person-fill"
                      } me-2`}></i>
                      {faceDisabled ? "Face Recognition Disabled" : (faceCaptured ? "Face Captured" : "Face Not Captured")}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className={`p-3 rounded text-center ${
                      fingerprintScanned || fingerDisabled 
                        ? "bg-success bg-opacity-10 text-success" 
                        : "bg-light text-muted"
                    }`}>
                      <i className={`bi ${
                        fingerDisabled 
                          ? "bi-hand-thumbs-down-fill" 
                          : fingerprintScanned 
                            ? "bi-hand-thumbs-up-fill" 
                            : "bi-hand-index-fill"
                      } me-2`}></i>
                      {fingerDisabled ? "Fingerprint Disabled" : (fingerprintScanned ? "Fingerprint Scanned" : "Fingerprint Not Scanned")}
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}