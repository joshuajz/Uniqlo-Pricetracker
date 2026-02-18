export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid #E8E4DF',
      padding: '20px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: '#aaa',
      fontSize: 12,
      background: '#FCFAF9',
    }}>
      <span>
        <strong style={{ color: '#555', fontWeight: 600 }}>Uniqlo Price Tracker</strong>
        {' '}— Updated daily. Not affiliated with Uniqlo Co., Ltd.
      </span>
      <span style={{ color: '#ccc' }}>© 2026</span>
    </footer>
  )
}
