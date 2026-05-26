export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🐾</span>
        <span className="font-bold text-gray-900 text-lg">PetCut</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <a
          href="#how-to-use"
          className="text-gray-600 hover:text-gray-900"
        >
          How to use
        </a>
        <a
          href="https://github.com/tahid02/videobgremover"
          target="_blank"
          rel="noreferrer"
          className="text-gray-600 hover:text-gray-900"
        >
          GitHub
        </a>
      </div>
    </nav>
  )
}
