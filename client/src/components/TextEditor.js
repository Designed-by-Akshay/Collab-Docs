import { useCallback, useEffect, useState } from "react";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { auth } from "../config/firebase";
import { Share2, Users, ChevronDown } from "lucide-react";

Quill.register("modules/cursors", QuillCursors);

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
  const navigate = useNavigate();
  const location = useLocation();
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();
  const [activeUsers, setActiveUsers] = useState([]);
  const [isUsersDropdownOpen, setIsUsersDropdownOpen] = useState(false);
  const [userColor, setUserColor] = useState(null);
  const [documentInfo, setDocumentInfo] = useState({
    owner: null,
    lastEditedBy: null,
  });
  const [isOwner, setIsOwner] = useState(false);
  const user = auth.currentUser;

  const signOut = async () => {
    try {
      if (isOwner) {
        const confirmLogout = window.confirm(
          "As the document owner, leaving will end the session for all users. Are you sure?"
        );
        if (!confirmLogout) return;
      }
      await auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const copyShareLink = () => {
    const shareLink = `${window.location.origin}/documents/${documentId}`;
    navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        const message = user?.isAnonymous 
          ? "Link copied! Note: You're in guest mode, so you might want to save this link to return later."
          : "Link copied to clipboard!";
        alert(message);
      })
      .catch((error) => {
        console.error("Error copying link:", error);
        alert("Failed to copy link. Please try again.");
      });
  };

  useEffect(() => {
    if (!user) {
      const currentPath = location.pathname;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    const s = io("http://localhost:3001");
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user, documentId, navigate, location]);

  useEffect(() => {
    if (!socket || !quill || !user) return;

    socket.once("load-document", (documentData) => {
      quill.setContents(documentData.data);
      setDocumentInfo({
        owner: documentData.owner,
        lastEditedBy: documentData.lastEditedBy,
      });
      setUserColor(documentData.userColor);
      setActiveUsers(documentData.activeUsers || []);
      setIsOwner(documentData.owner?.userId === user.uid);
      quill.enable();
    });

    socket.on("owner-disconnected", () => {
      alert("The document owner has ended the session.");
      navigate("/");
    });

    socket.emit("get-document", documentId, {
      uid: user.uid,
      displayName: user.displayName || (user.isAnonymous ? `Guest-${user.uid.slice(0, 4)}` : "Unknown User"),
      isAnonymous: user.isAnonymous
    });

    return () => {
      socket.off("owner-disconnected");
    };
  }, [socket, quill, documentId, user, navigate]);

  useEffect(() => {
    if (!socket || !quill) return;

    const cursors = quill.getModule('cursors');
    
    cursors.clearCursors();

    activeUsers.forEach(activeUser => {
      if (activeUser.userId !== user?.uid) {
        cursors.createCursor(
          activeUser.userId,
          activeUser.displayName,
          activeUser.color
        );
      }
    });

    const handleCursorUpdate = ({ userId, range, color, displayName }) => {
      if (userId !== user?.uid) {
        cursors.createCursor(userId, displayName, color);
        cursors.moveCursor(userId, range);
      }
    };

    const handleSelectionChange = (range) => {
      if (range && userColor) {
        socket.emit("cursor-change", range);
      }
    };

    socket.on("cursor-update", handleCursorUpdate);
    quill.on('selection-change', handleSelectionChange);

    return () => {
      socket.off("cursor-update", handleCursorUpdate);
      quill.off("selection-change", handleSelectionChange);
    };
  }, [socket, quill, activeUsers, user, userColor]);

  
  useEffect(() => {
    if (!socket || !quill) return;

    const handleChanges = (changeData) => {
      const { delta, userId } = changeData;
      if (userId !== user?.uid) {
        quill.updateContents(delta);
      }
    };
    
    socket.on("receive-changes", handleChanges);

    return () => {
      socket.off("receive-changes", handleChanges);
    };
  }, [socket, quill, user]);

  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (!socket || !quill) return;

    const handleTextChange = (delta, _, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };

    quill.on("text-change", handleTextChange);

    return () => {
      quill.off("text-change", handleTextChange);
    };
  }, [socket, quill]);

  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;

    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: "snow",
      modules: {
        toolbar: TOOLBAR_OPTIONS,
        cursors: {
          transformOnTextChange: true,
          hideDelayMs: 5000,
          hideSpeedMs: 0,
          selectionChangeSource: null
        }
      },
    });
    q.disable();
    q.setText("Loading...");
    setQuill(q);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleUsersChanged = (users) => {
      setActiveUsers(users);
    };

    const handleError = (error) => {
      console.error("Document error:", error);
      alert("An error occurred with the document. Please try refreshing the page.");
    };

    socket.on("users-changed", handleUsersChanged);
    socket.on("error", handleError);

    return () => {
      socket.off("users-changed", handleUsersChanged);
      socket.off("error", handleError);
    };
  }, [socket]);
  const UsersDropdown = () => (
    <div className="relative">
      <button
        onClick={() => setIsUsersDropdownOpen(!isUsersDropdownOpen)}
        className="flex items-center space-x-1 px-3 py-2 rounded hover:bg-gray-200"
      >
        <Users className="h-5 w-5 text-gray-600" />
        <span className="text-sm">
          {activeUsers.length} {activeUsers.length === 1 ? "user" : "users"}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-600" />
      </button>

      {isUsersDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-50 border">
          <div className="p-3 border-b">
            <h3 className="font-semibold">Document Users</h3>
          </div>
          <div className="p-3">
            <div className="mb-3">
              <span className="text-sm font-medium text-gray-600">Owner:</span>
              <div className="mt-1 flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="flex items-center">
                  {documentInfo.owner?.displayName || "Unknown"}
                  {documentInfo.owner?.isAnonymous && " (Guest)"}
                </span>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Active Users:</span>
              <div className="mt-1 space-y-2">
                {activeUsers.map((activeUser) => (
                  <div
                    key={activeUser.userId}
                    className="flex items-center space-x-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: activeUser.color }}
                    />
                    <span className="text-sm flex items-center space-x-1">
                      <span>{activeUser.displayName}</span>
                      {activeUser.isGuest && <span className="text-gray-500">(Guest)</span>}
                      {activeUser.userId === documentInfo.owner?.userId && 
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Owner</span>
                      }
                      {activeUser.userId === user.uid && 
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">You</span>
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between bg-gray-100 px-4 py-2 border-b">
        <div className="flex items-center space-x-4">
          <div className="text-lg font-semibold text-gray-800">My Document</div>
          {documentInfo.owner && (
            <span className="text-sm text-gray-600">
              Owned by {documentInfo.owner.displayName}
              {documentInfo.owner.isAnonymous && " (Guest)"}
            </span>
          )}
          {documentInfo.lastEditedBy && (
            <span className="text-sm text-gray-600">
              Last edited by {documentInfo.lastEditedBy.displayName} at{" "}
              {new Date(documentInfo.lastEditedBy.timestamp).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <UsersDropdown />
          <button
            onClick={copyShareLink}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
            title="Copy share link"
          >
            <Share2 className="h-5 w-5" />
            <span>Share</span>
          </button>
          <span className="text-gray-600">
            {user?.displayName || "Guest"}
            {user?.isAnonymous && " (Guest)"}
          </span>
          <button
            onClick={signOut}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-grow container mx-auto p-4" ref={wrapperRef}></div>

      {isUsersDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsUsersDropdownOpen(false)}
        />
      )}
    </div>
  );
}