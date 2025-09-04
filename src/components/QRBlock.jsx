import React from 'react'
import { QRCodeCanvas } from 'qrcode.react'

export default function QRBlock({ url }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 18 }}><QRCodeCanvas value={url} size={180} includeMargin /></a>
    </div>
  )
}
