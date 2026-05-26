interface Props {
  onCancel: () => void
}

export default function CancelButton({ onCancel }: Props) {
  return (
    <button
      onClick={onCancel}
      className="text-sm text-gray-500 hover:text-red-600 underline transition-colors"
    >
      Cancel
    </button>
  )
}
