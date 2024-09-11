"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Menu, Send, Plus, Trash2, Pencil } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { streamMessage, ChatMessage, Chat } from "../actions/stream-message";
import { readStreamableValue } from 'ai/rsc';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState<Chat[]>(() => {
    const initialChat: Chat = {
      id: Date.now().toString(),
      name: "New Chat 1",
      messages: [],
      lastUpdated: Date.now()
    };
    return [initialChat];
  });
  const [currentChat, setCurrentChat] = useState<Chat>(() => chats[0]);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedChats = localStorage.getItem('chats');
    if (storedChats) {
      const parsedChats = JSON.parse(storedChats);
      setChats(parsedChats);
      setCurrentChat(parsedChats[0]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('chats', JSON.stringify(chats));
  }, [chats]);

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      name: `New Chat ${chats.length + 1}`,
      messages: [],
      lastUpdated: Date.now()
    };
    setChats([newChat, ...chats]);
    setCurrentChat(newChat);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && currentChat) {
      const newMessage: ChatMessage = { id: currentChat.messages.length, role: "user", content: message };
      const updatedChat = { ...currentChat, messages: [...currentChat.messages, newMessage], lastUpdated: Date.now() };
      setCurrentChat(updatedChat);
      setChats(chats.map(chat => chat.id === updatedChat.id ? updatedChat : chat).sort((a, b) => b.lastUpdated - a.lastUpdated));
      setMessage("");

      const { output } = await streamMessage(updatedChat.messages);
      
      let streamContent = '';
      for await (const chunk of readStreamableValue(output)) {
        streamContent += chunk;
        setStreamingMessage(streamContent);
        scrollToBottom(); // Scroll while streaming
      }

      const finalChat = {
        ...updatedChat,
        messages: [
          ...updatedChat.messages,
          { id: updatedChat.messages.length, role: "assistant", content: streamContent }
        ]
      };
      setCurrentChat(finalChat);
      setChats(chats.map(chat => chat.id === finalChat.id ? finalChat : chat).sort((a, b) => b.lastUpdated - a.lastUpdated));
      setStreamingMessage("");
      scrollToBottom(); // Scroll after the final message is set
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const deleteChat = (chatId: string) => {
    if (chats.length <= 1) {
      // Prevent deleting the last chat
      alert("You can't delete the last chat.");
      setChatToDelete(null);
      return;
    }

    const updatedChats = chats.filter(chat => chat.id !== chatId);
    setChats(updatedChats);
    if (currentChat.id === chatId) {
      setCurrentChat(updatedChats[0]);
    }
    setChatToDelete(null);
  };

  const handleEditChatName = (chatId: string, newName: string) => {
    const updatedChats = chats.map(chat => 
      chat.id === chatId ? { ...chat, name: newName } : chat
    );
    setChats(updatedChats);
    
    // Update currentChat if it's the one being renamed
    if (currentChat.id === chatId) {
      setCurrentChat({ ...currentChat, name: newName });
    }
    
    setEditingChatId(null);
  };

  const renderMessage = (content: string) => {
    const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      const language = match[1] || 'text';
      const code = match[2].trim();
      parts.push(
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ margin: '1em 0' }}
        >
          {code}
        </SyntaxHighlighter>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts.map((part, index) => 
      typeof part === 'string' ? <p key={index}>{part}</p> : <div key={index}>{part}</div>
    );
  };

  const scrollToBottom = () => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [streamingMessage]);

  return (
    <div className="flex h-screen bg-gray-800 text-white relative">
      {sidebarOpen && (
        <aside className="w-[300px] bg-gray-800 p-4 relative">
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 left-4 p-2 bg-gray-700 rounded-md"
          >
            <Menu size={24} />
          </button>
          <button
            onClick={createNewChat}
            className="absolute top-4 right-4 p-2 bg-gray-700 rounded-md"
          >
            <Plus size={24} />
          </button>
          <h2 className="mt-16 mb-4">Chats</h2>
          <ul>
            {chats.sort((a, b) => b.lastUpdated - a.lastUpdated).map(chat => (
              <li
                key={chat.id}
                onClick={() => setCurrentChat(chat)}
                className={`cursor-pointer p-2 rounded flex justify-between items-center ${currentChat?.id === chat.id ? 'bg-gray-700' : ''} group hover:bg-gray-700`}
              >
                {editingChatId === chat.id ? (
                  <input
                    type="text"
                    defaultValue={chat.name}
                    onBlur={(e) => handleEditChatName(chat.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleEditChatName(chat.id, e.currentTarget.value);
                      }
                    }}
                    autoFocus
                    className="bg-gray-700 text-white rounded px-1"
                    onClick={(e) => e.stopPropagation()} // Prevent row click when editing
                  />
                ) : (
                  <span>{chat.name}</span>
                )}
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingChatId(chat.id);
                    }}
                    className="invisible group-hover:visible text-gray-400 hover:text-blue-500 mr-2"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatToDelete(chat.id);
                    }}
                    className={`invisible group-hover:visible text-gray-400 hover:text-red-500 ${chats.length <= 1 ? 'cursor-not-allowed opacity-50' : ''}`}
                    disabled={chats.length <= 1}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      )}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-4 left-4 p-2 bg-gray-700 rounded-md z-10"
        >
          <Menu size={24} />
        </button>
      )}
      <main className="flex-1 flex flex-col bg-gray-900 p-4">
        <h1 className="text-2xl font-bold mb-4 text-center">{currentChat.name}</h1>
        <div className="flex-1 overflow-hidden flex justify-center">
          <div className="w-full max-w-[800px] overflow-y-auto p-4" ref={messageContainerRef}>
            {currentChat?.messages.map((msg, index) => (
              <div key={index} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="mr-2 flex-shrink-0 flex items-center">
                    <Image src="/ai-logo.png" alt="AI Logo" width={30} height={30} />
                  </div>
                )}
                <div className={`max-w-[70%] p-3 rounded-2xl ${
                  msg.role === "user" 
                    ? "bg-blue-500 text-white rounded-br-none" 
                    : "bg-gray-700 text-white rounded-bl-none"
                }`}>
                  {renderMessage(msg.content)}
                </div>
              </div>
            ))}
            {streamingMessage && (
              <div className="mb-4 flex justify-start">
                <div className="mr-2 flex-shrink-0 flex items-center">
                  <Image src="/ai-logo.png" alt="AI Logo" width={30} height={30} />
                </div>
                <div className="max-w-[70%] p-3 rounded-2xl bg-gray-700 text-white rounded-bl-none">
                  {streamingMessage}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <div className="w-full max-w-[800px]">
            <form onSubmit={handleSubmit} className="relative">
              <TextareaAutosize
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                minRows={2}
                maxRows={5}
                className="w-full bg-gray-700 text-white rounded-lg py-3 px-3 pr-12 resize-none min-h-[50px]"
                disabled={!currentChat}
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-2"
                disabled={!currentChat}
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </main>
      <AlertDialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
        <AlertDialogContent className="bg-gray-800 border border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              This action cannot be undone. This will permanently delete the chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-white hover:bg-gray-600">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => chatToDelete && deleteChat(chatToDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
