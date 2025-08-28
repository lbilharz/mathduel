import React, { useEffect, useState, useRef } from "react";
import Ably from "ably";
import './Chat.css'

export default function Chat() {
  // Room ID and storage key for messages
  const roomId = "test-room";
  const storageKey = `chatMessages_${roomId}`;
  const [messages, setMessages] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [channel, setChannel] = useState(null);
  const [input, setInput] = useState("");
  const [name, setName] = useState(() => {
    return localStorage.getItem("chatName") || "";
  });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const clientId = "client-" + Math.floor(Math.random() * 10000);

    const client = new Ably.Realtime({
      authUrl: `/api/ably-token?clientId=${clientId}`
    });

    client.connection.once("connected", () => {
      console.log("Ably connected:", clientId);
    });

    const chan = client.channels.get("test-room");
    setChannel(chan);

    chan.subscribe("message", (msg) => {
      setMessages((prev) => [...prev, msg.data]);
    });

    return () => {
      chan.unsubscribe();
      client.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist messages to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  function send() {
    if (channel && input.trim() && name.trim()) {
      channel.publish("message", { text: input, name });
      setInput("");
    }
  }

  function handleNamePrompt() {
    const current = name || "";
    const newName = window.prompt("Bitte gib deinen Namen ein:", current);
    if (newName !== null && newName.trim() !== "") {
      setName(newName);
      localStorage.setItem("chatName", newName);
    }
  }


  return (
    <div className="chat">
      <div className="chat__name">
        {name
          ? (
            <p
              onClick={handleNamePrompt}
              style={{ cursor: "pointer", textDecoration: "underline dotted" }}
              title="Name ändern"
            >
              {name}
            </p>
          )
          : (
            <button onClick={handleNamePrompt}>
              Name festlegen
            </button>
          )
        }
      </div>
      <ul className='chat__messages'>
        {messages.map((m, i) => {
          const myMessage = m.name === name;
          return (
            <li
              key={i}
              className={"message " + (myMessage ? "message_mine" : "message_theirs")}
            >
              <span className='message__sender'>{m.name}</span>
              <span className='message__content'>{m.text}</span>
            </li>
          );
        })}
        <li ref={messagesEndRef}></li>
      </ul>
      <div className="chat__input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nachricht..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={send}>Senden</button>
      </div>
    </div>
  );
}
