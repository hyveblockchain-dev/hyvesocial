import '../styles/globals.css'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

function MyApp({ Component, pageProps }) {
  const [account, setAccount] = useState(null)
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_accounts' 
        })
        if (accounts.length > 0) {
          connectWallet()
        }
      } catch (error) {
        console.error('Error checking connection:', error)
      }
    }
  }

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!')
        return
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum, {
        name: 'hyve',
        chainId: 9200
      })
      const accounts = await provider.send('eth_requestAccounts', [])
      const signer = provider.getSigner()
      
      // Switch to Hyve network (chain ID 9200)
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x23F0' }], // 9200 in hex
        })
      } catch (switchError) {
        // Chain not added, try to add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x23F0',
                chainName: 'Hyve Blockchain',
                nativeCurrency: {
                  name: 'HYVE',
                  symbol: 'HYVE',
                  decimals: 18
                },
                rpcUrls: ['https://rpc.hyvechain.com'],
                blockExplorerUrls: ['https://explorer.hyvechain.com']
              }]
            })
          } catch (addError) {
            console.error('Error adding Hyve network:', addError)
          }
        }
      }

      setAccount(accounts[0])
      setProvider(provider)
      setSigner(signer)
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <nav style={{
        background: '#1a1a1a',
        padding: '1rem 2rem',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 'bold' }}>
          🐝 HYVE SOCIAL
        </h1>
        
        {account ? (
          <div style={{ color: '#fff' }}>
            {account.slice(0, 6)}...{account.slice(-4)}
          </div>
        ) : (
          <button
            onClick={connectWallet}
            style={{
              background: '#f59e0b',
              color: '#000',
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Connect Wallet
          </button>
        )}
      </nav>

      <Component {...pageProps} account={account} provider={provider} signer={signer} />
    </div>
  )
}

export default MyApp
