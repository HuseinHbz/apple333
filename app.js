const price = document.querySelector('#price');
const down = document.querySelector('#down');
const months = document.querySelector('#months');
const priceOutput = document.querySelector('#price-output');
const monthly = document.querySelector('#monthly');
const number = new Intl.NumberFormat('fa-IR');

function calculate() {
  const total = Number(price.value);
  const principal = total * (1 - Number(down.value));
  const count = Number(months.value);
  const monthlyPayment = Math.round((principal * 1.11) / count / 10000) * 10000;
  priceOutput.value = `${number.format(total)} تومان`;
  monthly.innerHTML = `${number.format(monthlyPayment)} <small>تومان</small>`;
}

[price, down, months].forEach((element) => element.addEventListener('input', calculate));
calculate();
