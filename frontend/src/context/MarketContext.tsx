import { createContext, useContext } from 'react'
import { DEFAULT_MARKET, type Market } from '../lib/markets'

export const MarketContext = createContext<Market>(DEFAULT_MARKET)
export const useMarket = () => useContext(MarketContext)
