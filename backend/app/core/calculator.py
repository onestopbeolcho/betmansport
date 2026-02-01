from decimal import Decimal, ROUND_HALF_UP

def calculate_kelly_percentage(odds: float, true_probability: float, fraction: float = 0.125) -> float:
    """
    Calculate the recommended bet size using the Fractional Kelly Criterion.
    
    Formula: f = (1/fraction_divisor) * ( (p * (b - 1) - q) / (b - 1) ) ??
    Standard Kelly: f = (bp - q) / b
    where:
      b = net odds received on the wager (odds - 1)
      p = probability of winning
      q = probability of losing (1 - p)
    
    Simplified for decimal odds (O):
    f = (p * O - 1) / (O - 1)
    
    Args:
        odds (float): Decimal odds offered by the bookmaker (Domestic).
        true_probability (float): The estimated true probability of winning (0 to 1).
        fraction (float): The Kelly fraction to use (default 1/8 = 0.125).
        
    Returns:
        float: Recommended percentage of bankroll to bet (0.0 to 1.0).
    """
    if odds <= 1:
        return 0.0
    
    # Kelly Formula
    # f* = (p * (o - 1) - (1 - p)) / (o - 1)  <-- This assumes b = o -1 
    # Let's use the standard form derived:
    # f = (p * o - 1) / (o - 1)
    
    kelly_full = (true_probability * odds - 1) / (odds - 1)
    
    if kelly_full <= 0:
        return 0.0
        
    kelly_fractional = kelly_full * fraction
    
    # Cap at a safe limit if needed, but for now return the raw calculation
    return round(max(0.0, kelly_fractional), 4)
