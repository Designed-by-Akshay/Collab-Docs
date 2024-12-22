import React, { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  updateProfile,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { generateFunName } from "../utils/nameGenerator";

const TypewriterText = ({ texts }) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const text = texts[currentTextIndex];
    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (currentText.length < text.length) {
          setCurrentText(text.slice(0, currentText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 1500);
        }
      } else {
        if (currentText.length === 0) {
          setIsDeleting(false);
          setCurrentTextIndex((currentTextIndex + 1) % texts.length);
        } else {
          setCurrentText(text.slice(0, currentText.length - 1));
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timer);
  }, [currentText, currentTextIndex, isDeleting, texts]);

  return (
    <div className="h-8">
      <span className="text-gray-600">{currentText}</span>
      <span className="animate-blink">|</span>
    </div>
  );
};

export default function Login() {
  const navigate = useNavigate();
  const googleProvider = new GoogleAuthProvider();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate(`/documents/${Math.random().toString(36).substr(2, 9)}`); // Redirect to a new document
    } catch (error) {
      console.error("Error signing in with Google:", error.message);
      alert("Failed to sign in with Google. Please try again.");
    }
  };

  const handleAnonymousAccess = async () => {
    try {
      const result = await signInAnonymously(auth);
      const funName = generateFunName();
      await updateProfile(result.user, { displayName: funName });
      navigate(`/documents/${Math.random().toString(36).substr(2, 9)}`); // Redirect to a new document
    } catch (error) {
      console.error("Error with anonymous access:", error.message);
      alert("Failed to access as guest. Please try again.");
    }
  };

  const typingTexts = [
    "Collaborate in real-time",
    "Create and edit documents seamlessly",
    "Share your ideas effortlessly",
    "Work together from anywhere",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4">
          Collab Docs
        </h1>
        <div className="text-lg text-gray-600">
          <TypewriterText texts={typingTexts} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-semibold text-center text-gray-800 mb-6">
          Welcome to Collab Docs
        </h2>

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center space-x-2 bg-white border-2 border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition duration-200 mb-4 hover:border-blue-400 group"
        >
          <img
            className="h-5 w-5"
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google logo"
          />
          <span className="group-hover:text-blue-600">Sign in with Google</span>
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <button
          onClick={handleAnonymousAccess}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-6 py-3 font-medium hover:opacity-90 transition duration-200"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
