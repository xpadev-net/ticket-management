import { Scanner } from '@yudiel/react-qr-scanner';

interface QrScannerProps {
  onScan: (qrCode: string) => void;
  paused: boolean;
}

export default function QrScanner({ onScan, paused }: QrScannerProps) {
  return (
    <div className={`max-w-2xl mx-auto ${paused ? 'opacity-50' : ''}`}>
      <Scanner 
        onScan={(result) => onScan(result[0].rawValue)}
        formats={[
          'qr_code', // QR コード
          'micro_qr_code', // マイクロ QR
        ]}
        sound={false}
        allowMultiple
        paused={paused}
      />
    </div>
  )
}
