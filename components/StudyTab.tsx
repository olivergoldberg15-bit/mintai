"use client";

import { useState } from "react";
import TasksView from "./TasksView";
import CardsView from "./CardsView";
import QuizView from "./QuizView";
import ClassView from "./ClassView";
import CalcTab from "./CalcTab";

const VIEWS = [
  { id: "tasks", label: "To-do" },
  { id: "cards", label: "Cards" },
  { id: "quiz",  label: "Quiz" },
  { id: "class", label: "Class" },
  { id: "calc",  label: "Calc" },
] as const;

type View = (typeof VIEWS)[number]["id"];

export default function StudyTab({ userId }: { userId: string | null }) {
  const [view, setView] = useState<View>("tasks");

  return (
    <>
      <div className="seg" style={{ overflowX: "auto" }}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={view === v.id ? "on" : ""}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mt16">
        {view === "tasks" && <TasksView userId={userId} />}
        {view === "cards" && <CardsView userId={userId} />}
        {view === "quiz"  && <QuizView  userId={userId} />}
        {view === "class" && <ClassView userId={userId} />}
        {view === "calc"  && <CalcTab />}
      </div>
    </>
  );
}
