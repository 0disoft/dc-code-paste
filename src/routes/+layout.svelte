<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>dc-code-paste</title>
  <meta name="description" content="디씨인사이드 글쓰기용 리치 텍스트 복사 도구" />
</svelte:head>

{@render children()}
