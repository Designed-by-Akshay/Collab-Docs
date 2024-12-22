import { useCallback, useEffect, useRef, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import { Share2, Users } from "lucide-react";
import { auth } from "../config/firebase";

const SAVE_INTERVAL_MS = 2000;
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

export default function TextEditor() {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();
  const [collaborators, setCollaborators] = useState([]);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const editorInitialized = useRef(false);
  const editorRef = useRef();
  const user = auth.currentUser;

  const copyShareLink = () => {
    const shareLink = window.location.href;
    navigator.clipboard
      .writeText(shareLink)
      .then(() => alert("Share link copied to clipboard!"))
      .catch((err) => console.error("Failed to copy share link:", err));
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    const s = io("http://localhost:3001");
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket == null || quill == null) return;

    socket.once("load-document", (document) => {
      quill.setContents(document);
      quill.enable();
    });

    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  useEffect(() => {
    if (socket == null || quill == null) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (socket == null || quill == null) return;

    const handler = (delta) => {
      quill.updateContents(delta);
    };
    socket.on("receive-changes", handler);

    return () => {
      socket.off("receive-changes", handler);
    };
  }, [socket, quill]);

  const initializeQuill = useCallback(() => {
    if (editorRef.current == null || editorInitialized.current) return;

    editorInitialized.current = true;
    const q = new Quill(editorRef.current, {
      theme: "snow",
      modules: {
        toolbar: TOOLBAR_OPTIONS,
      },
    });

    q.disable();
    q.setText("Loading...");
    setQuill(q);
  }, []);

  useEffect(() => {
    initializeQuill();
  }, [initializeQuill]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Sticky Navigation */}
      <div className="sticky top-0 bg-white shadow-md z-50 flex justify-between items-center px-4 py-2">
        <div className="flex items-center space-x-4">
          {/* Collaborators Icon */}
          <button
            onClick={() => setShowCollaborators((prev) => !prev)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <Users className="h-5 w-5" />
            <span>Collaborators</span>
          </button>
          {/* Share Link */}
          <button
            onClick={copyShareLink}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Share2 className="inline-block h-5 w-5" />
            Share
          </button>
        </div>

        {/* User Greeting and Sign Out */}
        <div className="flex items-center space-x-4">
          <span className="text-gray-700">
            Hello, {user?.displayName || "Guest"}
          </span>
          <button
            onClick={signOut}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Collaborators List */}
      {showCollaborators && (
        <div className="absolute top-16 right-4 bg-white shadow-lg p-4 rounded-lg z-50">
          <h3 className="text-sm font-semibold mb-2">Collaborators</h3>
          {collaborators.length === 0 ? (
            <p className="text-gray-500">No collaborators yet.</p>
          ) : (
            <ul>
              {collaborators.map((collab, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: collab.color }}
                  >
                    {collab.name[0].toUpperCase()}
                  </div>
                  <span>{collab.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="flex-grow container mx-auto mt-4 p-4 rounded-lg">
        <div ref={editorRef}></div>
      </div>
    </div>
  );
}
