<script setup>
const accessibleLabel = '已打码的游戏品牌标识'
</script>

<template>
  <svg class="switching-masked-logo" viewBox="0 0 144 32" role="img" :aria-label="accessibleLabel">
    <g fill="none" stroke="#ec243a" stroke-width="2" stroke-linecap="round" transform="rotate(-17 25 16)">
      <ellipse cx="24" cy="16" rx="20" ry="11" /><ellipse cx="24" cy="16" rx="15" ry="8" /><ellipse cx="24" cy="16" rx="10" ry="5" />
      <path d="M24 5Q39 6 47 1M26 10Q41 10 46 6M24 15Q35 15 41 10" />
    </g>
    <g fill="#55585e"><path d="M57 9h13v15H57zM77 7h17v17H77zM102 10h13v14h-13zM123 8h14v16h-14z" /></g>
    <g fill="#f7f8fa" opacity=".94"><path d="M5 10h11v7H5zM20 20h12v7H20zM33 7h10v7H33zM56 11h14v5H56zM64 18h15v7H64zM82 5h7v25h-7zM94 14h15v7H94zM118 5h9v25h-9zM132 14h9v6h-9z" /></g>
  </svg>
</template>
