import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import ChatWindow, { ChatState } from '@/Components/Chat/ChatWindow';

/** Section chats + the common chat, full page. The floating chat window renders the same ChatWindow. */
export default function ChatIndex(props: ChatState) {
    const fromLink = new URLSearchParams(window.location.search).has('c');
    return (
        <AppLayout header="Chat">
            <Head title="Chat" />
            <ChatWindow initial={props} syncUrl startInThread={fromLink || props.channels.length === 1} />
        </AppLayout>
    );
}
