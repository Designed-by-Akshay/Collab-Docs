require("dotenv").config();
const mongoose = require("mongoose");
const Document = require("./Document");

mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB:", err));

const io = require("socket.io")(3001, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const defaultValue = "";

const documentSessions = new Map();
const documentUsers = new Map();

const CURSOR_COLORS = [
  "#FF0000", "#00FF00", "#0000FF", "#FFA500", "#800080",
  "#008000", "#FF69B4", "#4B0082", "#FF4500", "#32CD32",
  "#BA55D3", "#20B2AA", "#FF6347", "#4169E1", "#8B4513",
  "#48D1CC", "#FF1493", "#4682B4", "#DC143C", "#9370DB"
];

function getNextColor(documentId) {
  if (!documentUsers.has(documentId)) {
    return CURSOR_COLORS[0];
  }
  const usedColors = new Set(
    Array.from(documentUsers.get(documentId).values())
      .map(user => user.color)
  );
  return CURSOR_COLORS.find(color => !usedColors.has(color)) || CURSOR_COLORS[0];
}

io.on("connection", (socket) => {
  socket.on("get-document", async (documentId, userData) => {
    try {
      const document = await findOrCreateDocument(documentId, userData);
      
      // Initialize session with the document's actual owner
      if (!documentSessions.has(documentId)) {
        documentSessions.set(documentId, {
          ownerId: document.owner?.userId, // Use the document's owner, not the current user
          active: true,
          lastSave: new Date(),
          data: document.data // Keep track of latest data
        });
      }

      if (!documentUsers.has(documentId)) {
        documentUsers.set(documentId, new Map());
      }

      const userInfo = {
        userId: userData?.uid || `guest-${socket.id}`,
        displayName: userData?.displayName || `Guest-${Math.floor(Math.random() * 1000)}`,
        color: getNextColor(documentId),
        isGuest: !userData?.uid,
        socketId: socket.id,
        joinedAt: new Date(),
        isOwner: document.owner?.userId === userData?.uid
      };

      documentUsers.get(documentId).set(socket.id, userInfo);
      socket.join(documentId);

      socket.emit("load-document", {
        data: document.data || defaultValue,
        owner: document.owner,
        lastEditedBy: document.lastEditedBy,
        userColor: userInfo.color,
        activeUsers: Array.from(documentUsers.get(documentId).values())
      });

      // Broadcast updated user list
      socket.broadcast.to(documentId).emit("users-changed", 
        Array.from(documentUsers.get(documentId).values())
      );

      socket.on("send-changes", (delta) => {
       
        const session = documentSessions.get(documentId);
        if (session) {
          session.data = delta; 
        }

        socket.broadcast.to(documentId).emit("receive-changes", {
          delta,
          userId: userInfo.userId,
          displayName: userInfo.displayName,
          color: userInfo.color
        });
      });

      socket.on("cursor-change", (range) => {
        socket.broadcast.to(documentId).emit("cursor-update", {
          userId: userInfo.userId,
          displayName: userInfo.displayName,
          color: userInfo.color,
          range: range
        });
      });

      socket.on("save-document", async (data) => {
        try {
          // Update both database and session
          await Document.findByIdAndUpdate(documentId, {
            data,
            lastEditedBy: {
              userId: userInfo.userId,
              displayName: userInfo.displayName,
              timestamp: new Date()
            }
          });

          const session = documentSessions.get(documentId);
          if (session) {
            session.lastSave = new Date();
            session.data = data;
          }
        } catch (error) {
          console.error("Error saving document:", error);
          socket.emit("error", "Failed to save document");
        }
      });

      // Handle disconnection
      socket.on("disconnect", async () => {
        const session = documentSessions.get(documentId);
        if (!session) return;

        // Check if the disconnecting user is the owner
        const isOwner = userInfo.userId === session.ownerId;
        
        // Remove user from active users
        documentUsers.get(documentId).delete(socket.id);
        const remainingUsers = documentUsers.get(documentId);

        if (isOwner) {
          try {
            // Save final state before owner disconnects
            const finalData = session.data;
            if (finalData) {
              await Document.findByIdAndUpdate(documentId, {
                data: finalData,
                lastEditedBy: {
                  userId: userInfo.userId,
                  displayName: userInfo.displayName,
                  timestamp: new Date()
                }
              });
            }

            // Notify others that owner has disconnected
            io.to(documentId).emit("owner-disconnected");
            
            // Clean up session
            documentSessions.delete(documentId);
            documentUsers.delete(documentId);
          } catch (error) {
            console.error("Error handling owner disconnection:", error);
          }
        } else {
          if (remainingUsers.size > 0) {
            // Update active users list
            io.to(documentId).emit("users-changed", 
              Array.from(remainingUsers.values())
            );
          } else {
            // No users left, clean up
            documentUsers.delete(documentId);
          }
        }
      });

    } catch (error) {
      console.error("Error in document setup:", error);
      socket.emit("error", "Failed to load document");
    }
  });
});

async function findOrCreateDocument(id, userData = null) {
  if (!id) return null;

  try {
    // First try to find existing document
    const existingDocument = await Document.findById(id);
    if (existingDocument) {
      return existingDocument;
    }

    // Only create new document if it doesn't exist
    return await Document.create({
      _id: id,
      data: defaultValue,
      owner: userData ? {
        userId: userData.uid,
        displayName: userData.displayName,
        isAnonymous: userData.isAnonymous || false
      } : null,
      lastEditedBy: userData ? {
        userId: userData.uid,
        displayName: userData.displayName,
        timestamp: new Date()
      } : null
    });
  } catch (error) {
    console.error("Error in findOrCreateDocument:", error);
    throw error;
  }
}