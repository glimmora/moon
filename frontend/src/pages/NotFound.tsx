import { Link } from "react-router-dom";
import { Moon } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Moon className="mb-4 h-16 w-16 text-moon-400" />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-neutral-500">This page drifted into the dark side of the moon.</p>
      <Link to="/" className="btn-primary mt-6">
        Back to Earth
      </Link>
    </div>
  );
}
