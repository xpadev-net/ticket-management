import { useZxing } from 'react-zxing'

interface QrScannerProps {
  onScan: (qrCode: string) => void;
}

export default function QrScanner({ onScan }: QrScannerProps) {
  const { ref } = useZxing({
    onDecodeResult(result) {
      onScan(result.getText())
    },
    constraints: {
      video: {
        facingMode: 'environment'
      },
      audio: false
    }
  })

  return (
    <div>
      <video ref={ref} />
    </div>
  )
}