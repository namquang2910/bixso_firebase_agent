"""
streamlit_app.py
CourseAI — Streamlit frontend for the Express API agent.

Setup:
  pip install streamlit requests

Run:
  streamlit run streamlit_app.py

Make sure your Express API is running first:
  npm run api   (in your courseai project folder)
"""

import streamlit as st
import requests
import uuid
from datetime import datetime

# ─── Config ───────────────────────────────────────────────────────────────────

API_BASE = "http://localhost:3000"
CHAT_ENDPOINT    = f"{API_BASE}/api/chat"
HISTORY_ENDPOINT = f"{API_BASE}/api/chat/history"
HEALTH_ENDPOINT  = f"{API_BASE}/api/health"

# ─── Page setup ───────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="CourseAI Agent",
    page_icon="📚",
    layout="wide",
)

# ─── Session state ─────────────────────────────────────────────────────────────
# Streamlit reruns the whole script on every interaction,
# so we store state in st.session_state to persist across reruns.

if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())[:8]  # short unique ID

if "messages" not in st.session_state:
    st.session_state.messages = []  # list of {role, content, timestamp}

if "api_reachable" not in st.session_state:
    st.session_state.api_reachable = False

# ─── Helpers ──────────────────────────────────────────────────────────────────

def check_api_health() -> bool:
    """Ping the Express API health endpoint."""
    try:
        res = requests.get(HEALTH_ENDPOINT, timeout=3)
        return res.status_code == 200
    except Exception:
        return False


def send_message(message: str, session_id: str) -> dict:
    """POST /api/chat and return the response dict."""
    res = requests.post(
        CHAT_ENDPOINT,
        json={"message": message, "sessionId": session_id},
        timeout=120,  # agent can take a while with multiple tool calls
    )
    res.raise_for_status()
    return res.json()


def clear_history(session_id: str) -> None:
    """DELETE /api/chat/history for this session."""
    requests.delete(f"{HISTORY_ENDPOINT}?sessionId={session_id}", timeout=5)


def format_time(dt: datetime) -> str:
    return dt.strftime("%H:%M")

# ─── Sidebar ──────────────────────────────────────────────────────────────────

with st.sidebar:
    st.title("📚 CourseAI")
    st.caption("AI agent for your learning platform")
    st.divider()

    # API status indicator
    st.subheader("🔌 API Status")
    if st.button("Check Connection", use_container_width=True):
        st.session_state.api_reachable = check_api_health()

    if st.session_state.api_reachable:
        st.success("Connected to API ✅")
    else:
        st.error("API not reachable ❌")
        st.caption("Make sure you ran: `npm run api`")

    st.divider()

    # Session info
    st.subheader("🔑 Session")
    st.code(st.session_state.session_id, language=None)
    st.caption("Each session keeps its own conversation history.")

    # New session button
    if st.button("🔄 New Session", use_container_width=True):
        st.session_state.session_id = str(uuid.uuid4())[:8]
        st.session_state.messages = []
        st.rerun()

    # Clear history button
    if st.button("🗑️ Clear History", use_container_width=True):
        clear_history(st.session_state.session_id)
        st.session_state.messages = []
        st.rerun()

    st.divider()

    # Example questions
    st.subheader("💡 Try asking")
    examples = [
        "What courses is Alice enrolled in?",
        "Which students completed the Python ML course?",
        "Show me all lessons in the React TypeScript course",
        "Which instructor has the highest rating?",
        "How many students passed the React quiz?",
        "List all certificates Carol has earned",
        "What are the beginner level courses?",
        "Show me Bob's quiz attempt history",
    ]
    for example in examples:
        if st.button(example, use_container_width=True, key=f"ex_{example[:20]}"):
            st.session_state._pending_message = example
            st.rerun()

# ─── Main chat area ───────────────────────────────────────────────────────────

st.title("📚 CourseAI Agent")
st.caption("Ask anything about courses, students, enrollments, quizzes, and certificates.")

# Check API on first load
if not st.session_state.api_reachable:
    st.session_state.api_reachable = check_api_health()

# API not reachable warning banner
if not st.session_state.api_reachable:
    st.warning(
        "⚠️ Cannot reach the API at `http://localhost:3000`. "
        "Start it with `npm run api` in your courseai project folder.",
        icon="⚠️",
    )

# ── Chat history display ──────────────────────────────────────────────────────

chat_container = st.container()

with chat_container:
    if not st.session_state.messages:
        st.info("👋 Ask a question to get started! Try one of the examples in the sidebar.")
    else:
        for msg in st.session_state.messages:
            role     = msg["role"]
            content  = msg["content"]
            time_str = msg.get("time", "")

            if role == "user":
                with st.chat_message("user", avatar="🧑"):
                    st.markdown(content)
                    if time_str:
                        st.caption(time_str)
            else:
                with st.chat_message("assistant", avatar="🤖"):
                    st.markdown(content)
                    if time_str:
                        st.caption(time_str)

# ── Chat input ────────────────────────────────────────────────────────────────

# Handle example button clicks
pending = st.session_state.pop("_pending_message", None)

user_input = st.chat_input(
    "Ask about courses, students, enrollments...",
    disabled=not st.session_state.api_reachable,
) or pending

if user_input:
    now = format_time(datetime.now())

    # Add user message to display immediately
    st.session_state.messages.append({
        "role": "user",
        "content": user_input,
        "time": now,
    })

    # Show user message right away
    with chat_container:
        with st.chat_message("user", avatar="🧑"):
            st.markdown(user_input)
            st.caption(now)

    # Call the API with a spinner
    with st.spinner("🤖 Agent is thinking..."):
        try:
            response = send_message(user_input, st.session_state.session_id)
            answer   = response.get("answer", "No answer returned.")
            answer_time = format_time(datetime.now())

            st.session_state.messages.append({
                "role": "assistant",
                "content": answer,
                "time": answer_time,
            })

            # Show assistant response
            with chat_container:
                with st.chat_message("assistant", avatar="🤖"):
                    st.markdown(answer)
                    st.caption(answer_time)

        except requests.exceptions.ConnectionError:
            st.error("❌ Could not connect to the API. Is `npm run api` running?")
            st.session_state.api_reachable = False

        except requests.exceptions.Timeout:
            st.error("⏱️ Request timed out. The agent is taking too long — try a simpler question.")

        except requests.exceptions.HTTPError as e:
            st.error(f"❌ API error: {e.response.status_code} — {e.response.text}")

        except Exception as e:
            st.error(f"❌ Unexpected error: {str(e)}")
