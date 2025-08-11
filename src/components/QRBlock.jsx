import React from 'react'
import { QRCodeCanvas } from 'qrcode.react'

export default function QRBlock({ url }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <QRCodeCanvas value={url} size={180} includeMargin />
      <div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Link zum Beitreten</div>
        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 18 }}>{url}</a>
      </div>
    </div>
  )
}
