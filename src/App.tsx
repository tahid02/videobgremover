import Navbar from './components/Navbar'
import DropZone from './components/DropZone'

export default function App() {
  function handleFile(file: File) {
    console.log('File selected:', file.name, file.size)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <div className="max-w-3xl mx-auto py-12 px-4 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Remove your pet's video background.
          </h1>
          <p className="text-gray-500 mb-8">
            Free. Private. In your browser. No upload. No account.
          </p>
        </div>
        <DropZone onFile={handleFile} />
      </main>
    </div>
  )
}
